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
    typeof record.horsePlate === "string" &&
    Array.isArray(record.fuels)
  );
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function excelPayload(record) {
  const startKm = numberOrZero(record.startKm);
  const finalKm = numberOrZero(record.finalKm);
  const tripRow = {
    id: record.id,
    dataHora: record.createdAt,
    data: record.tripDate || record.createdAt?.slice(0, 10) || "",
    dataFinal: record.tripEndDate || "",
    motorista: String(record.driverName || "").toUpperCase(),
    empresa: String(record.companyName || "").toUpperCase(),
    placaCavalo: String(record.horsePlate || "").toUpperCase(),
    placaCarreta: String(record.trailerPlate || "").toUpperCase(),
    categoria: String(record.vehicleCategory || "").toUpperCase(),
    kmInicial: startKm,
    kmFinal: finalKm,
    kmRodado: finalKm >= startKm ? finalKm - startKm : 0,
    caixinha: numberOrZero(record.vehicleCash),
    frete: numberOrZero(record.freightValue),
    despesasViagem: numberOrZero(record.travelExpenses),
    quantidadeDiarias: numberOrZero(record.dailyCount),
    valorDiarias: numberOrZero(record.dailyAllowanceCost),
    comissao: numberOrZero(record.commissionValue),
    salarioProporcional: numberOrZero(record.salaryTripCost),
    quantidadeCarregada: numberOrZero(record.loadAmount),
    chaveNfCarregamento: record.loadInvoiceKey || "",
    status: record.status === "canceled" ? "CANCELADA" : "ATIVA",
    motivoCancelamento: record.cancelReason || "",
    editadoEm: record.editedAt || "",
  };
  const fuelRows = record.fuels.map((fuel, index) => ({
    id: `${record.id}-AB${index + 1}`,
    viagemId: record.id,
    dataHora: record.createdAt,
    data: fuel.date || tripRow.data,
    motorista: tripRow.motorista,
    empresa: tripRow.empresa,
    placaCavalo: tripRow.placaCavalo,
    placaAbastecida: String(fuel.vehiclePlate || record.horsePlate || "").toUpperCase(),
    combustivel: fuel.fuelType || "DIESEL S10",
    km: numberOrZero(fuel.km),
    litros: numberOrZero(fuel.liters),
    valorCombustivel: numberOrZero(fuel.value),
    chaveNf: fuel.invoiceKey || "",
  }));
  return { tripRow, fuelRows };
}

async function mirrorToPowerAutomate(record) {
  const flowUrl = Netlify.env.get("POWER_AUTOMATE_URL");
  if (!flowUrl) return false;

  const rows = excelPayload(record);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(flowUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "TAZ_NETLIFY_APP",
        sentAt: new Date().toISOString(),
        record,
        tripRow: rows.tripRow,
        fuelRows: rows.fuelRows,
      }),
      signal: controller.signal,
    });
    return response.ok;
  } finally {
    clearTimeout(timeout);
  }
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

    const text = await request.text();
    if (text.length > 150000) {
      return json(413, { ok: false, error: "Registro muito grande." });
    }

    const payload = JSON.parse(text);
    if (!validRecord(payload.record)) {
      return json(400, { ok: false, error: "Registro inválido." });
    }

    const storedRecord = {
      ...payload.record,
      submittedBy: {
        userId: user.id,
        email: user.email,
        name: user.user_metadata?.display_name || user.user_metadata?.name || "",
      },
    };
    const store = getStore({ name: "taz-trips", consistency: "strong" });
    await store.setJSON(`trip/${payload.record.id}`, storedRecord, {
      metadata: {
        createdAt: payload.record.createdAt,
        tripDate: payload.record.tripDate,
        driver: payload.record.driverName,
        plate: payload.record.horsePlate,
        userId: user.id,
        status: payload.record.status || "active",
      },
    });

    let mirroredToExcel = false;
    try {
      mirroredToExcel = await mirrorToPowerAutomate(storedRecord);
    } catch (error) {
      console.error("Optional Excel mirror failed:", error);
    }

    return json(200, {
      ok: true,
      stored: true,
      mirroredToExcel,
      recordId: payload.record.id,
    });
  } catch (error) {
    console.error("Central storage error:", error);
    return json(500, { ok: false, error: "Falha ao gravar na base online." });
  }
};

export const config = { path: "/api/sync-excel" };
