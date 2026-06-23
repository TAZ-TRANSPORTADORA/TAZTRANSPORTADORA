import { getStore } from "@netlify/blobs";
import { authenticatedUser } from "./_auth.mjs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

function validRecord(record) {
  return (
    record &&
    typeof record === "object" &&
    typeof record.id === "string" &&
    record.id.length >= 8 &&
    typeof record.driverName === "string" &&
    typeof record.companyName === "string" &&
    typeof record.vehiclePlate === "string" &&
    typeof record.description === "string" &&
    ["PREVENTIVA", "CORRETIVA"].includes(String(record.maintenanceType || "").toUpperCase())
  );
}

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Metodo nao permitido." });
  }

  try {
    const user = await authenticatedUser(request);
    if (!user) {
      return json(401, { ok: false, error: "Sessao invalida ou expirada." });
    }

    const text = await request.text();
    if (text.length > 50000) {
      return json(413, { ok: false, error: "Registro de manutencao muito grande." });
    }

    const payload = JSON.parse(text);
    if (!validRecord(payload.record)) {
      return json(400, { ok: false, error: "Registro de manutencao invalido." });
    }

    const storedRecord = {
      ...payload.record,
      maintenanceType: String(payload.record.maintenanceType || "").toUpperCase(),
      companyName: String(payload.record.companyName || "").toUpperCase(),
      vehiclePlate: String(payload.record.vehiclePlate || "").toUpperCase(),
      submittedBy: {
        userId: user.id,
        email: user.email,
        name: user.user_metadata?.display_name || user.user_metadata?.name || "",
      },
    };

    const store = getStore({ name: "taz-maintenance", consistency: "strong" });
    await store.setJSON(`maintenance/${payload.record.id}`, storedRecord, {
      metadata: {
        createdAt: payload.record.createdAt,
        maintenanceDate: payload.record.maintenanceDate,
        type: storedRecord.maintenanceType,
        driver: storedRecord.driverName,
        plate: storedRecord.vehiclePlate,
        company: storedRecord.companyName,
        userId: user.id,
        status: payload.record.status || "active",
      },
    });

    return json(200, {
      ok: true,
      stored: true,
      recordId: payload.record.id,
    });
  } catch (error) {
    console.error("Maintenance storage error:", error);
    return json(500, { ok: false, error: "Falha ao gravar manutencao na base online." });
  }
};

export const config = { path: "/api/sync-maintenance" };
