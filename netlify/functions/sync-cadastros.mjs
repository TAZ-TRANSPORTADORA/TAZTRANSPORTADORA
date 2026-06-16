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

const allowedOperations = new Set(["list", "upsert"]);
const allowedTypes = new Set(["drivers", "horses", "trailers"]);

function validItem(item) {
  return (
    item &&
    typeof item.id === "string" &&
    item.id.length >= 8 &&
    typeof item.name === "string" &&
    item.name.trim().length >= 2 &&
    typeof item.active === "boolean"
  );
}

async function listType(store, type) {
  const items = [];
  const listing = await store.list({ prefix: `${type}/` });
  for (const blob of listing.blobs) {
    const item = await store.get(blob.key, { type: "json", consistency: "strong" });
    if (item) items.push({ ...item, syncStatus: "synced" });
  }
  return items;
}

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Método não permitido." });
  }

  try {
    const user = await authenticatedUser(request);
    if (!user) {
      return json(401, { ok: false, error: "Sessão inválida ou expirada." });
    }

    const payload = await request.json();
    if (!allowedOperations.has(payload.operation) || !allowedTypes.has(payload.type)) {
      return json(400, { ok: false, error: "Operação de cadastro inválida." });
    }
    if (payload.operation === "upsert" && !validItem(payload.item)) {
      return json(400, { ok: false, error: "Cadastro inválido." });
    }
    if (payload.operation === "upsert" && userRole(user) !== "admin") {
      return json(403, { ok: false, error: "Apenas administradores podem alterar cadastros." });
    }

    const store = getStore({ name: "taz-registries", consistency: "strong" });

    if (payload.operation === "list") {
      const [drivers, horses, trailers] = await Promise.all([
        listType(store, "drivers"),
        listType(store, "horses"),
        listType(store, "trailers"),
      ]);
      return json(200, { ok: true, registries: { drivers, horses, trailers } });
    }

    await store.setJSON(`${payload.type}/${payload.item.id}`, payload.item);
    return json(200, { ok: true, stored: true });
  } catch (error) {
    console.error("Registry storage error:", error);
    return json(500, { ok: false, error: "Falha ao gravar cadastro na base online." });
  }
};

export const config = { path: "/api/sync-cadastros" };
