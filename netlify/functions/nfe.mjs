import https from "node:https";
import zlib from "node:zlib";
import { getStore } from "@netlify/blobs";
import { authenticatedUser } from "./_auth.mjs";

const NFE_DFE_ENDPOINT =
  "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
const NFE_DFE_ACTION =
  "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse";
const UF_CODES = {
  AC: "12",
  AL: "27",
  AP: "16",
  AM: "13",
  BA: "29",
  CE: "23",
  DF: "53",
  ES: "32",
  GO: "52",
  MA: "21",
  MT: "51",
  MS: "50",
  MG: "31",
  PA: "15",
  PB: "25",
  PR: "41",
  PE: "26",
  PI: "22",
  RJ: "33",
  RN: "24",
  RS: "43",
  RO: "11",
  RR: "14",
  SC: "42",
  SP: "35",
  SE: "28",
  TO: "17",
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

function env(name) {
  if (typeof Netlify !== "undefined" && Netlify.env?.get) {
    const value = Netlify.env.get(name);
    if (value) return value;
  }
  return process.env[name] || "";
}

function envJoined(name) {
  const single = env(name).replace(/\s/g, "");
  if (single) return single;

  const parts = [];
  for (let index = 1; index <= 20; index += 1) {
    const part = env(`${name}_${index}`) || env(`${name}_PART_${index}`);
    if (!part && parts.length) break;
    if (part) parts.push(part.replace(/\s/g, ""));
  }
  return parts.join("");
}

async function blobText(storeName, key) {
  try {
    const store = getStore({ name: storeName, consistency: "strong" });
    return await store.get(key, { type: "text", consistency: "strong" });
  } catch (_error) {
    return "";
  }
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function removeAccents(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function envSlug(value) {
  return removeAccents(value).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tagValues(xml, tagName) {
  const values = [];
  const pattern = new RegExp(`<(?:\\w+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`, "gi");
  let match = null;
  while ((match = pattern.exec(String(xml || "")))) {
    values.push(match[1]);
  }
  return values;
}

function firstTagValue(xml, tagName) {
  return tagValues(xml, tagName)[0]?.trim() || "";
}

function parseJsonConfig(name) {
  const raw = env(name).trim();
  if (!raw) return null;
  return JSON.parse(raw);
}

function readSefazCompanies() {
  const config = parseJsonConfig("NFE_SEFAZ_CONFIG_JSON");
  if (!config) return [];
  const tpAmb = String(config.tpAmb || (config.ambiente === "homologacao" ? "2" : "1"));
  const endpoint = config.endpoint || NFE_DFE_ENDPOINT;
  const companies = Array.isArray(config) ? config : config.empresas || [];
  return companies
    .filter((company) => company && company.ativo !== false)
    .map((company) => {
      const name = company.empresa || company.nome || company.name || "";
      const slug = envSlug(company.slug || name);
      const uf = String(company.uf || "").toUpperCase();
      const cUFRaw = company.cUF || company.codigoUF || UF_CODES[uf] || "";
      const cUF = cUFRaw ? String(cUFRaw).padStart(2, "0") : "";
      const cnpj = onlyDigits(company.cnpj);
      const pfxBase64Env = company.certPfxBase64Env || company.pfxBase64Env || `NFE_CERT_${slug}_PFX_BASE64`;
      const passwordEnv = company.certPasswordEnv || company.pfxPasswordEnv || `NFE_CERT_${slug}_PASSWORD`;
      return {
        name,
        cnpj,
        cUF,
        tpAmb: String(company.tpAmb || tpAmb),
        endpoint: company.endpoint || endpoint,
        pfxBase64: envJoined(pfxBase64Env) || company.pfxBase64 || "",
        passphrase: env(passwordEnv) || company.certPassword || company.password || "",
        pfxBase64Env,
        passwordEnv,
      };
    })
    .filter((company) => company.name && company.cnpj && company.cUF);
}

async function companyPfxBase64(company) {
  const envValue = envJoined(company.pfxBase64Env) || company.pfxBase64 || "";
  if (envValue) return envValue;
  const slug = envSlug(company.name);
  const stored = await blobText("taz-sefaz-certificates", `cert/${slug}/pfxBase64`);
  return String(stored || "").replace(/\s/g, "");
}

function meudanfeErrorMessage(status, body) {
  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch (_error) {
    parsed = null;
  }
  const message = parsed?.message || parsed?.error || parsed?.erro || "";
  if (status === 400) {
    return message ||
      "Meu Danfe recusou a consulta. Confira se a chave tem 44 digitos e se a nota ja esta disponivel para consulta.";
  }
  if (status === 401 || status === 403) {
    return "Meu Danfe recusou a API Key. Confira a variavel MEUDANFE_API_KEY no Netlify.";
  }
  if (status === 404) {
    return "NF-e nao encontrada no Meu Danfe para essa chave.";
  }
  return message || body || "Nao foi possivel consultar a NF-e.";
}

function findXmlValue(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const text = value.trim();
    return text.startsWith("<") ? text : "";
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const xml = findXmlValue(item);
      if (xml) return xml;
    }
    return "";
  }
  if (typeof value === "object") {
    const preferredKeys = [
      "xml",
      "data",
      "nfe",
      "NFe",
      "nfeProc",
      "document",
      "documento",
      "result",
      "retorno",
      "content",
      "conteudo",
    ];
    for (const key of preferredKeys) {
      const xml = findXmlValue(value[key]);
      if (xml) return xml;
    }
    for (const item of Object.values(value)) {
      const xml = findXmlValue(item);
      if (xml) return xml;
    }
  }
  return "";
}

function parseXmlFromResponse(body, contentType) {
  const text = String(body || "").trim();
  if (!text) return "";
  if (text.startsWith("<")) return text;
  const mayBeJson = contentType.includes("application/json") || text.startsWith("{") || text.startsWith("[");
  if (!mayBeJson) return text;
  const parsed = JSON.parse(text);
  const xml = findXmlValue(parsed);
  if (xml) return xml;
  throw new Error("O Meu Danfe respondeu sem XML da NF-e.");
}

async function fetchMeuDanfe(url, apiKey) {
  const baseHeaders = {
    accept: "application/xml, text/xml, application/json",
  };
  const attempts = [
    {
      "api-key": apiKey,
      "Api-Key": apiKey,
      apikey: apiKey,
      "x-api-key": apiKey,
    },
    { authorization: `API-KEY ${apiKey}` },
    { authorization: `ApiKey ${apiKey}` },
    { authorization: apiKey },
    { authorization: `Bearer ${apiKey}` },
  ];

  let last = null;
  for (const headers of attempts) {
    const response = await fetch(url, { headers: { ...baseHeaders, ...headers } });
    const body = await response.text();
    const result = {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type") || "",
      body,
    };
    if (response.ok || (response.status !== 401 && response.status !== 403)) {
      return result;
    }
    last = result;
  }
  return last;
}

function buildSefazEnvelope(company, chave) {
  const distDFe = `<distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${xmlEscape(company.tpAmb)}</tpAmb><cUFAutor>${xmlEscape(company.cUF)}</cUFAutor><CNPJ>${xmlEscape(company.cnpj)}</CNPJ><consChNFe><chNFe>${xmlEscape(chave)}</chNFe></consChNFe></distDFeInt>`;
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg>${distDFe}</nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`;
}

function postSefazSoap(company, soapBody) {
  return new Promise((resolve, reject) => {
    const target = new URL(company.endpoint || NFE_DFE_ENDPOINT);
    const body = Buffer.from(soapBody, "utf8");
    const request = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        pfx: Buffer.from(company.pfxBase64, "base64"),
        passphrase: company.passphrase,
        headers: {
          "content-type": `application/soap+xml; charset=utf-8; action="${NFE_DFE_ACTION}"`,
          "content-length": body.length,
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode || 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    request.setTimeout(30000, () => {
      request.destroy(new Error("Tempo esgotado ao consultar a SEFAZ."));
    });
    request.on("error", reject);
    request.end(body);
  });
}

function decodeDocZip(value) {
  const compressed = Buffer.from(String(value || "").trim(), "base64");
  try {
    return zlib.gunzipSync(compressed).toString("utf8");
  } catch (_error) {
    return compressed.toString("utf8");
  }
}

function parseSefazResponse(xml) {
  const cStat = firstTagValue(xml, "cStat");
  const xMotivo = firstTagValue(xml, "xMotivo");
  const docs = tagValues(xml, "docZip").map(decodeDocZip).filter(Boolean);
  return { cStat, xMotivo, docs };
}

function fullNfeXmlFromDocs(docs) {
  return docs.find((doc) => /<(?:\w+:)?nfeProc\b/i.test(doc) || /<(?:\w+:)?NFe\b/i.test(doc)) || "";
}

function sefazErrorMessage(result, company) {
  const detail = result.xMotivo || "sem detalhe da SEFAZ";
  if (result.cStat === "137") {
    return `SEFAZ nao retornou XML para ${company.name}. A NF-e pode nao estar autorizada para esse CNPJ.`;
  }
  if (result.cStat === "138") {
    return `SEFAZ encontrou documento para ${company.name}, mas ainda nao retornou XML completo. Pode ser necessario manifestar a NF-e ou autorizar o CNPJ no XML.`;
  }
  if (result.cStat === "656") {
    return `SEFAZ bloqueou a consulta por consumo indevido para ${company.name}. Aguarde alguns minutos antes de tentar novamente.`;
  }
  return `SEFAZ recusou a consulta para ${company.name}: ${detail}${result.cStat ? ` (cStat ${result.cStat})` : ""}.`;
}

async function fetchSefazNfeXml(chave, payload = {}) {
  const companies = readSefazCompanies();
  if (!companies.length) return null;
  const requestedCompany = removeAccents(payload.empresa || payload.company || "").toUpperCase();
  const selectedCompanies = requestedCompany
    ? companies.filter((company) => removeAccents(company.name).toUpperCase() === requestedCompany)
    : companies;
  const candidates = selectedCompanies.length ? selectedCompanies : companies;
  const errors = [];

  for (const company of candidates) {
    const pfxBase64 = await companyPfxBase64(company);
    const activeCompany = { ...company, pfxBase64 };
    if (!activeCompany.pfxBase64 || !activeCompany.passphrase) {
      errors.push(`${company.name}: certificado ou senha nao configurados (${company.pfxBase64Env} / ${company.passwordEnv}).`);
      continue;
    }
    try {
      const response = await postSefazSoap(activeCompany, buildSefazEnvelope(activeCompany, chave));
      if (!response.ok) {
        errors.push(`${company.name}: SEFAZ respondeu HTTP ${response.status}.`);
        continue;
      }
      const result = parseSefazResponse(response.body);
      const xml = fullNfeXmlFromDocs(result.docs);
      if (xml) {
        return { ok: true, company: company.name, xml, cStat: result.cStat, xMotivo: result.xMotivo };
      }
      errors.push(sefazErrorMessage(result, company));
      if (result.cStat === "656") break;
    } catch (error) {
      errors.push(`${company.name}: ${error.message}`);
    }
  }

  return {
    ok: false,
    status: 404,
    error: errors.filter(Boolean).join(" | ") || "SEFAZ nao retornou XML para essa chave.",
  };
}

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Metodo nao permitido." });
  }

  const user = await authenticatedUser(request);
  if (!user) {
    return json(401, { ok: false, error: "Login necessario." });
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch (_error) {
    return json(400, { ok: false, error: "Informe a chave da NF-e." });
  }

  const chave = onlyDigits(payload.chave);
  if (chave.length !== 44) {
    return json(400, { ok: false, error: "A chave da NF-e precisa ter 44 digitos." });
  }

  let sefazResult = null;
  try {
    sefazResult = await fetchSefazNfeXml(chave, payload);
    if (sefazResult?.ok) {
      return json(200, {
        ok: true,
        chave,
        source: "SEFAZ_DFE",
        company: sefazResult.company,
        xml: sefazResult.xml,
      });
    }
  } catch (error) {
    sefazResult = {
      ok: false,
      status: 500,
      error: `Configuracao da SEFAZ invalida: ${error.message}`,
    };
  }

  const apiUrl = env("MEUDANFE_API_URL");
  const apiKey = env("MEUDANFE_API_KEY");
  if (!apiUrl || !apiKey) {
    if (sefazResult) {
      return json(sefazResult.status || 404, {
        ok: false,
        error: sefazResult.error,
      });
    }
    return json(501, {
      ok: false,
      error: "Consulta automatica da NF-e ainda nao configurada. Use Importar XML ou cadastre os certificados da SEFAZ ou MEUDANFE_API_URL e MEUDANFE_API_KEY no Netlify.",
    });
  }

  try {
    const url = apiUrl
      .replace("{chave}", chave)
      .replace("{Chave-Acesso}", chave)
      .replace("{CHAVE-ACESSO}", chave)
      .replace("{chave-acesso}", chave)
      .replace("{chave_acesso}", chave)
      .replace("{CHAVE_ACESSO}", chave);
    const response = await fetchMeuDanfe(url, apiKey);
    const contentType = response.contentType;
    const body = response.body;
    if (!response.ok) {
      return json(response.status, {
        ok: false,
        error: meudanfeErrorMessage(response.status, body),
      });
    }
    if (contentType.includes("pdf")) {
      return json(415, {
        ok: false,
        error: "O endpoint do Meu Danfe retornou PDF/DANFE. Para preencher os campos automaticamente, precisamos do endpoint que retorna XML.",
      });
    }
    const xml = parseXmlFromResponse(body, contentType);
    return json(200, { ok: true, chave, xml });
  } catch (error) {
    return json(500, {
      ok: false,
      error: `Falha ao consultar NF-e: ${error.message}`,
    });
  }
};

export const config = { path: "/api/nfe" };
