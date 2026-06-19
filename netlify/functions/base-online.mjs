import { getStore } from "@netlify/blobs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

async function allJson(store, prefix) {
  const values = [];
  for await (const page of store.list({ prefix, paginate: true })) {
    for (const blob of page.blobs) {
      const value = await store.get(blob.key, {
        type: "json",
        consistency: "strong",
      });
      if (value) values.push(value);
    }
  }
  return values;
}

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Método não permitido." });
  }

  const adminKey = Netlify.env.get("TAZ_ADMIN_KEY");
  if (!adminKey) {
    return json(503, { ok: false, error: "Código administrativo não configurado." });
  }
  if (request.headers.get("x-taz-admin-key") !== adminKey) {
    return json(401, { ok: false, error: "Código administrativo inválido." });
  }

  try {
    const trips = getStore({ name: "taz-trips", consistency: "strong" });
    const registries = getStore({ name: "taz-registries", consistency: "strong" });
    const [records, drivers, horses, trailers] = await Promise.all([
      allJson(trips, "trip/"),
      allJson(registries, "drivers/"),
      allJson(registries, "horses/"),
      allJson(registries, "trailers/"),
    ]);
    records.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    return json(200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      records,
      registries: { drivers, horses, trailers },
    });
  } catch (error) {
    console.error("Online database read error:", error);
    return json(500, { ok: false, error: "Falha ao consultar a base online." });
  }
};

export const config = { path: "/api/base-online" };
