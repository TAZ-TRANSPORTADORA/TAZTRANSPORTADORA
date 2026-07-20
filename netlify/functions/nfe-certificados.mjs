import { getStore } from "@netlify/blobs";
import { authenticatedUser, userRole } from "./_auth.mjs";

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

function removeAccents(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function envSlug(value) {
  return removeAccents(value).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function isAdmin(request) {
  const adminKey = env("TAZ_ADMIN_KEY");
  if (adminKey && request.headers.get("x-taz-admin-key") === adminKey) return true;

  const user = await authenticatedUser(request);
  return userRole(user) === "admin";
}

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Metodo nao permitido." });
  }

  if (!(await isAdmin(request))) {
    return json(403, { ok: false, error: "Acesso administrativo necessario." });
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch (_error) {
    return json(400, { ok: false, error: "Informe empresa e certificado em Base64." });
  }

  const empresa = String(payload.empresa || payload.company || "").trim();
  const slug = envSlug(payload.slug || empresa);
  const pfxBase64 = String(payload.pfxBase64 || payload.base64 || "").replace(/\s/g, "");

  if (!empresa || !slug) {
    return json(400, { ok: false, error: "Informe a empresa do certificado." });
  }
  if (!pfxBase64 || !/^[A-Za-z0-9+/=]+$/.test(pfxBase64)) {
    return json(400, { ok: false, error: "Certificado Base64 invalido." });
  }

  const store = getStore({ name: "taz-sefaz-certificates", consistency: "strong" });
  await store.set(`cert/${slug}/pfxBase64`, pfxBase64, {
    metadata: {
      empresa,
      updatedAt: new Date().toISOString(),
    },
  });

  return json(200, {
    ok: true,
    empresa,
    slug,
    length: pfxBase64.length,
    stored: true,
  });
};

export const config = { path: "/api/nfe-certificados" };
