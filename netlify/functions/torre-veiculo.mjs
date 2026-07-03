import { authenticatedUser } from "./_auth.mjs";
import { loadScaniaData, loadTripHistoryComparison } from "./torre.mjs";

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

function plateKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function vehicleKeys(vehicle) {
  return [
    vehicle?.cavalo,
    vehicle?.cavalo_trator,
    vehicle?.placa_cavalo,
    vehicle?.registrationNumber,
    vehicle?.placa,
    vehicle?.nome,
    vehicle?.motorista,
    vehicle?.vin,
  ]
    .map(plateKey)
    .filter(Boolean);
}

function findVehicle(vehicles, plate) {
  const wanted = plateKey(plate);
  if (!wanted) return null;
  return vehicles.find((vehicle) => vehicleKeys(vehicle).includes(wanted)) || null;
}

async function hasAccess(request) {
  const adminKey = env("TAZ_ADMIN_KEY");
  if (adminKey && request.headers.get("x-taz-admin-key") === adminKey) return true;
  return Boolean(await authenticatedUser(request));
}

function publicVehicleSnapshot(vehicle, requestedPlate, generatedAt) {
  return {
    source: "SCANIA_RFMS",
    capturedAt: new Date().toISOString(),
    generatedAt: generatedAt || "",
    requestedPlate: String(requestedPlate || "").toUpperCase(),
    matchedPlate: String(vehicle.cavalo || vehicle.placa_cavalo || vehicle.registrationNumber || "").toUpperCase(),
    vehicleName: String(vehicle.placa || vehicle.nome || vehicle.motorista || "").toUpperCase(),
    company: String(vehicle.empresa || "").toUpperCase(),
    vin: vehicle.vin || "",
    status: vehicle.status || "",
    odometerKm: numberOrNull(vehicle.odometro_km),
    dieselPct: numberOrNull(vehicle.diesel_pct),
    arlaPct: numberOrNull(vehicle.arla_pct),
    speedKmh: numberOrNull(vehicle.velocidade),
    vmax24Kmh: numberOrNull(vehicle.vmax24),
    pctAbove100: numberOrNull(vehicle.pct_acima_100),
    updatedAt: vehicle.atualizado_em || "",
  };
}

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Metodo nao permitido." });
  }

  if (!(await hasAccess(request))) {
    return json(401, { ok: false, error: "Login necessario." });
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const plate = payload.plate || payload.horsePlate || "";
    if (!plateKey(plate)) {
      return json(400, { ok: false, error: "Placa do cavalo nao informada." });
    }

    const data = await loadScaniaData();
    const vehicles = Array.isArray(data?.frota?.veiculos) ? data.frota.veiculos : [];
    const vehicle = findVehicle(vehicles, plate);

    if (!vehicle) {
      return json(404, { ok: false, error: "Veiculo nao encontrado na Torre de Controle." });
    }

    let tripHistory = null;
    if (payload.startAt || payload.endAt) {
      try {
        tripHistory = await loadTripHistoryComparison({
          vin: vehicle.vin,
          startAt: payload.startAt,
          endAt: payload.endAt,
          currentVehicle: vehicle,
          currentCapturedAt: data?.frota?.gerado_em,
        });
      } catch (error) {
        tripHistory = {
          available: false,
          reason: error.message || "Falha ao consultar o historico da Torre.",
        };
      }
    }

    return json(200, {
      ok: true,
      vehicle: publicVehicleSnapshot(vehicle, plate, data?.frota?.gerado_em),
      tripHistory,
    });
  } catch (error) {
    console.error("Vehicle tower lookup error:", error);
    return json(502, { ok: false, error: error.message || "Falha ao consultar a Torre de Controle." });
  }
};

export const config = { path: "/api/torre-veiculo" };
