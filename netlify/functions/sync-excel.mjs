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

function plateKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizedLoadEntries(record = {}) {
  const entries = Array.isArray(record.loadEntries) ? record.loadEntries : [];
  if (entries.length) return entries;
  if (record.loadAmount || record.loadInvoiceKey) {
    return [{
      number: 1,
      amount: record.loadAmount || "",
      invoiceKey: record.loadInvoiceKey || "",
    }];
  }
  return [];
}

function loadTotal(record = {}) {
  return normalizedLoadEntries(record).reduce((total, load) => total + numberOrZero(load.amount), 0);
}

function loadInvoiceSummary(record = {}) {
  return normalizedLoadEntries(record)
    .map((load) => load.invoiceKey)
    .filter(Boolean)
    .join(" | ");
}

function invoiceNumberFromKey(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 44) {
    const number = digits.slice(25, 34).replace(/^0+/, "");
    return number || digits.slice(25, 34);
  }
  return digits || String(value || "").trim();
}

function safeFileName(value) {
  return String(value || "comprovante-despesa.jpg")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "comprovante-despesa.jpg";
}

async function storeTravelExpenseReceipt(record, user) {
  const receipt = record.travelExpenseReceipt;
  if (!receipt?.dataUrl) return record;

  if (typeof receipt.dataUrl !== "string" || !receipt.dataUrl.startsWith("data:image/")) {
    return {
      ...record,
      travelExpenseReceipt: null,
    };
  }

  const attachmentKey = `travel-expenses/${record.id}/${Date.now()}-${safeFileName(receipt.fileName)}`;
  const attachments = getStore({ name: "taz-attachments", consistency: "strong" });
  await attachments.setJSON(attachmentKey, {
    type: "travelExpenseReceipt",
    recordId: record.id,
    fileName: receipt.fileName || "comprovante-despesa.jpg",
    mimeType: receipt.mimeType || "image/jpeg",
    size: numberOrZero(receipt.size),
    capturedAt: receipt.capturedAt || "",
    uploadedAt: new Date().toISOString(),
    uploadedBy: {
      userId: user.id,
      email: user.email,
    },
    dataUrl: receipt.dataUrl,
  });

  return {
    ...record,
    travelExpenseReceipt: {
      fileName: receipt.fileName || "comprovante-despesa.jpg",
      mimeType: receipt.mimeType || "image/jpeg",
      size: numberOrZero(receipt.size),
      capturedAt: receipt.capturedAt || "",
      attachmentKey,
      hasFile: true,
    },
  };
}

function excelPayload(record) {
  const startKm = numberOrZero(record.startKm);
  const finalKm = numberOrZero(record.finalKm);
  const telemetry = record.torreVehicle || {};
  const tripHistory = record.torreTrip || {};
  const driverTripKm = finalKm >= startKm ? finalKm - startKm : 0;
  const horsePlateKey = plateKey(record.horsePlate);
  const driverTripLiters = (record.fuels || [])
    .filter((fuel) => String(fuel.fuelType || "DIESEL S10").toUpperCase().includes("DIESEL"))
    .filter((fuel) => {
      const supplied = plateKey(fuel.vehiclePlate || record.horsePlate);
      return !horsePlateKey || !supplied || supplied === horsePlateKey;
    })
    .reduce((sum, fuel) => sum + numberOrZero(fuel.liters), 0);
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
    comprovanteDespesa: record.travelExpenseReceipt?.hasFile ? "SIM" : "NAO",
    arquivoComprovante: record.travelExpenseReceipt?.fileName || "",
    chaveAnexoComprovante: record.travelExpenseReceipt?.attachmentKey || "",
    quantidadeDiarias: numberOrZero(record.dailyCount),
    valorDiarias: numberOrZero(record.dailyAllowanceCost),
    comissao: numberOrZero(record.commissionValue),
    salarioProporcional: numberOrZero(record.salaryTripCost),
    quantidadeCarregada: loadTotal(record) || numberOrZero(record.loadAmount),
    chaveNfCarregamento: loadInvoiceSummary(record) || record.loadInvoiceKey || "",
    status: record.status === "canceled" ? "CANCELADA" : "ATIVA",
    motivoCancelamento: record.cancelReason || "",
    editadoEm: record.editedAt || "",
    torreKmVeiculo: numberOrZero(telemetry.odometerKm),
    torreDieselPct: numberOrZero(telemetry.dieselPct),
    torreArlaPct: numberOrZero(telemetry.arlaPct),
    torreVelocidadeAtual: numberOrZero(telemetry.speedKmh),
    torreVelocidadeMax24h: numberOrZero(telemetry.vmax24Kmh),
    torrePctAcima100: numberOrZero(telemetry.pctAbove100),
    torreAtualizadoEm: telemetry.updatedAt || "",
    torreHistoricoStatus: tripHistory.available ? "OK" : tripHistory.reason || "",
    torreKmViagem: numberOrZero(tripHistory.km),
    motoristaKmViagem: driverTripKm,
    diferencaKmTorre: Number.isFinite(Number(tripHistory.km)) ? numberOrZero(tripHistory.km) - driverTripKm : 0,
    torreLitrosViagem: numberOrZero(tripHistory.liters),
    motoristaLitrosViagem: driverTripLiters,
    torreMediaKmLViagem: numberOrZero(tripHistory.kmPerLiter),
    motoristaMediaKmLViagem: driverTripLiters ? driverTripKm / driverTripLiters : 0,
    torreVmaxViagem: numberOrZero(tripHistory.vmaxKmh),
    torrePctAcima100Viagem: numberOrZero(tripHistory.pctAbove100),
    torreDieselFinalPct: numberOrZero(tripHistory.dieselEndPct),
    torreArlaFinalPct: numberOrZero(tripHistory.arlaEndPct),
    torreAmostrasViagem: numberOrZero(tripHistory.samples),
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
    numeroNf: fuel.nfe?.numero || invoiceNumberFromKey(fuel.invoiceKey),
    emitenteNf: fuel.nfe?.emitente || "",
    cnpjEmitenteNf: fuel.nfe?.cnpjEmitente || "",
    produtoNf: fuel.nfe?.products?.[0]?.description || "",
  }));
  const loadRows = normalizedLoadEntries(record).map((load, index) => ({
    id: `${record.id}-CG${index + 1}`,
    viagemId: record.id,
    dataHora: record.createdAt,
    data: tripRow.data,
    motorista: tripRow.motorista,
    empresa: tripRow.empresa,
    placaCavalo: tripRow.placaCavalo,
    placaCarreta: tripRow.placaCarreta,
    carregamento: index + 1,
    quantidadeCarregada: numberOrZero(load.amount),
    chaveNf: load.invoiceKey || "",
    numeroNf: load.nfe?.numero || invoiceNumberFromKey(load.invoiceKey),
    emitenteNf: load.nfe?.emitente || "",
    cnpjEmitenteNf: load.nfe?.cnpjEmitente || "",
    origemNf: load.nfe?.origem || "",
    destinoNf: load.nfe?.destino || "",
    pesoBrutoNf: numberOrZero(load.nfe?.pesoBruto),
    pesoLiquidoNf: numberOrZero(load.nfe?.pesoLiquido),
  }));
  return { tripRow, fuelRows, loadRows };
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
        loadRows: rows.loadRows,
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
    if (text.length > 1800000) {
      return json(413, { ok: false, error: "Registro muito grande." });
    }

    const payload = JSON.parse(text);
    if (!validRecord(payload.record)) {
      return json(400, { ok: false, error: "Registro inválido." });
    }

    const recordWithStoredAttachment = await storeTravelExpenseReceipt(payload.record, user);
    const storedRecord = {
      ...recordWithStoredAttachment,
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
