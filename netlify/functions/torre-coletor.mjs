import { loadScaniaData } from "./torre.mjs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export default async () => {
  try {
    const data = await loadScaniaData({ force: true });
    return json(200, {
      ok: true,
      collectedAt: data?.frota?.gerado_em || new Date().toISOString(),
      vehicles: data?.frota?.veiculos?.length || 0,
      history: data?.historico || null,
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error.message || "Falha ao coletar historico da Torre.",
    });
  }
};

export const config = {
  path: "/api/torre-coletor",
  schedule: "*/30 * * * *",
};
