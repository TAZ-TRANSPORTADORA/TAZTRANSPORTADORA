import { authenticatedUser } from "./_auth.mjs";

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

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
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

  const apiUrl = env("MEUDANFE_API_URL");
  const apiKey = env("MEUDANFE_API_KEY");
  if (!apiUrl || !apiKey) {
    return json(501, {
      ok: false,
      error: "Consulta automatica da NF-e ainda nao configurada. Use Importar XML ou cadastre MEUDANFE_API_URL e MEUDANFE_API_KEY no Netlify.",
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
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        "x-api-key": apiKey,
        accept: "application/xml, text/xml, application/json",
      },
    });
    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();
    if (!response.ok) {
      return json(response.status, {
        ok: false,
        error: body || "Nao foi possivel consultar a NF-e.",
      });
    }
    if (contentType.includes("application/json")) {
      const data = JSON.parse(body);
      return json(200, {
        ok: true,
        chave,
        xml: data.xml || data.data?.xml || data.nfe?.xml || body,
      });
    }
    return json(200, { ok: true, chave, xml: body });
  } catch (error) {
    return json(500, {
      ok: false,
      error: `Falha ao consultar NF-e: ${error.message}`,
    });
  }
};

export const config = { path: "/api/nfe" };
