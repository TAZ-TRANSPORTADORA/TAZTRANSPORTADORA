const TORRE_ORIGIN = "https://torre.taztransportadora.com.br";

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

function splitSetCookie(header) {
  if (!header) return [];
  return header.split(/,(?=\s*[^;,]+=)/g).map((part) => part.trim()).filter(Boolean);
}

function responseCookies(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  return splitSetCookie(headers.get("set-cookie"));
}

function saveCookies(jar, headers) {
  for (const cookie of responseCookies(headers)) {
    const pair = cookie.split(";")[0];
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function attr(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i");
  return tag.match(pattern)?.[1] || "";
}

function hiddenInputs(html) {
  const values = {};
  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0];
    if (attr(tag, "type").toLowerCase() !== "hidden") continue;
    const name = attr(tag, "name");
    if (name) values[name] = attr(tag, "value");
  }
  return values;
}

async function torreRequest(path, options = {}) {
  const jar = options.jar || new Map();
  const headers = {
    "user-agent": "TAZ-Dashboard/1.0",
    accept: options.accept || "text/html,application/json",
    ...options.headers,
  };
  const cookies = cookieHeader(jar);
  if (cookies) headers.cookie = cookies;

  const response = await fetch(new URL(path, TORRE_ORIGIN), {
    method: options.method || "GET",
    redirect: "manual",
    headers,
    body: options.body,
  });
  saveCookies(jar, response.headers);
  return response;
}

async function loginTorre(user, password) {
  const jar = new Map();
  const loginPage = await torreRequest("/login", { jar });
  const html = await loginPage.text().catch(() => "");
  const params = new URLSearchParams(hiddenInputs(html));
  params.set("usuario", user);
  params.set("senha", password);

  const response = await torreRequest("/login", {
    jar,
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      referer: `${TORRE_ORIGIN}/login`,
      origin: TORRE_ORIGIN,
    },
    body: params.toString(),
  });

  if (![200, 302, 303].includes(response.status)) {
    throw new Error(`Login da Torre recusado (${response.status}).`);
  }

  const location = response.headers.get("location");
  if (location) {
    await torreRequest(location, { jar });
  }
  return jar;
}

async function torreJson(path, jar) {
  const response = await torreRequest(`${path}?t=${Date.now()}`, {
    jar,
    accept: "application/json",
  });

  if ([301, 302, 303, 401, 403].includes(response.status)) {
    throw new Error("Sessao da Torre nao autorizada. Confira usuario e senha.");
  }
  if (!response.ok) {
    throw new Error(`Torre respondeu ${response.status}.`);
  }
  return response.json();
}

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Metodo nao permitido." });
  }

  const adminKey = env("TAZ_ADMIN_KEY");
  if (!adminKey) {
    return json(503, { ok: false, error: "Codigo administrativo nao configurado." });
  }
  if (request.headers.get("x-taz-admin-key") !== adminKey) {
    return json(401, { ok: false, error: "Codigo administrativo invalido." });
  }

  const user = env("TORRE_USER") || env("TORRE_USUARIO");
  const password = env("TORRE_PASSWORD") || env("TORRE_SENHA");
  if (!user || !password) {
    return json(503, { ok: false, error: "Credenciais da Torre nao configuradas no Netlify." });
  }

  try {
    const jar = await loginTorre(user, password);
    const [frota, medias] = await Promise.all([
      torreJson("/frota_ao_vivo.json", jar),
      torreJson("/medias.json", jar),
    ]);

    return json(200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      frota,
      medias,
    });
  } catch (error) {
    console.error("Torre integration error:", error);
    return json(502, { ok: false, error: error.message || "Falha ao consultar a Torre." });
  }
};

export const config = { path: "/api/torre" };
