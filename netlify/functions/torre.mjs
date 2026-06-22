import { createHash, createHmac } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { authenticatedUser, canViewAll, companyAllowed, userCompanies, userRole } from "./_auth.mjs";

const SCANIA_HOST = "https://dataaccess.scania.com";
const DEFAULT_RFMS_BASE = "https://dataaccess.scania.com/rfms4";
const SPEED_LIMIT = 100;
const MOVING_SPEED = 3;
const tokenCache = new Map();

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

async function dashboardAccess(request) {
  const adminKey = env("TAZ_ADMIN_KEY");
  if (adminKey && request.headers.get("x-taz-admin-key") === adminKey) {
    return { role: "admin", companies: ["*"], all: true, user: null };
  }

  const user = await authenticatedUser(request);
  if (!user) return { error: json(401, { ok: false, error: "Login necessario." }) };

  const role = userRole(user);
  if (!["admin", "empresa", "dashboard"].includes(role)) {
    return { error: json(403, { ok: false, error: "Usuario sem acesso ao dashboard." }) };
  }

  const companies = userCompanies(user);
  const all = canViewAll(user);
  if (!all && !companies.length) {
    return { error: json(403, { ok: false, error: "Usuario sem empresa liberada." }) };
  }

  return { role, companies: all ? ["*"] : companies, all, user };
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function scaniaCompanies() {
  const raw = env("SCANIA_RFMS_CONFIG_JSON") || env("FROTA_CONFIG_JSON");
  if (raw) {
    const parsed = safeJsonParse(raw, null);
    const empresas = Array.isArray(parsed) ? parsed : parsed?.empresas;
    if (Array.isArray(empresas)) {
      return empresas
        .filter((item) => item && item.ativo !== false)
        .map((item) => ({
          empresa: String(item.empresa || item.nome || "").trim(),
          baseUrl: String(item.base_url || item.baseUrl || DEFAULT_RFMS_BASE).replace(/\/+$/, ""),
          clientId: String(item.client_id || item.clientId || "").trim(),
          clientSecret: String(item.client_secret || item.clientSecret || "").trim(),
        }))
        .filter((item) => item.empresa && item.clientId && item.clientSecret);
    }
  }

  return [
    ["TAZ", "SCANIA_TAZ"],
    ["Pratazil", "SCANIA_PRATAZIL"],
    ["Riluca", "SCANIA_RILUCA"],
  ]
    .map(([empresa, prefix]) => ({
      empresa,
      baseUrl: env(`${prefix}_BASE_URL`) || DEFAULT_RFMS_BASE,
      clientId: env(`${prefix}_CLIENT_ID`),
      clientSecret: env(`${prefix}_CLIENT_SECRET`),
    }))
    .filter((item) => item.clientId && item.clientSecret)
    .map((item) => ({ ...item, baseUrl: item.baseUrl.replace(/\/+$/, "") }));
}

function b64urlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized + "=".repeat((4 - (normalized.length % 4)) % 4), "base64");
}

function b64urlEncode(bytes) {
  return Buffer.from(bytes).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function postForm(path, fields) {
  const response = await fetch(new URL(path, SCANIA_HOST), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams(fields),
  });
  const text = await response.text();
  const data = safeJsonParse(text || "{}", {});
  if (!response.ok) {
    throw new Error(data.error || data.message || `Scania auth respondeu ${response.status}.`);
  }
  return data;
}

function tokenKey(company) {
  return createHash("sha256").update(company.clientId).digest("hex").slice(0, 18);
}

async function scaniaToken(company, force = false) {
  const key = tokenKey(company);
  const cached = tokenCache.get(key);
  if (!force && cached && cached.expiresAt > Date.now() + 60000) return cached.token;

  const challenge = await postForm("/auth/clientid2challenge", { clientId: company.clientId });
  const signature = createHmac("sha256", b64urlDecode(company.clientSecret))
    .update(b64urlDecode(challenge.challenge))
    .digest();
  const response = b64urlEncode(signature);
  const tokenData = await postForm("/auth/response2token", {
    clientId: company.clientId,
    Response: response,
  });
  if (!tokenData.token) throw new Error(`Token nao retornado para ${company.empresa}.`);

  tokenCache.set(key, {
    token: tokenData.token,
    expiresAt: Date.now() + 50 * 60 * 1000,
  });
  return tokenData.token;
}

async function scaniaGet(company, resource, params = {}, options = {}) {
  const token = await scaniaToken(company, options.forceToken);
  const url = new URL(`${company.baseUrl}/${resource}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });

  const request = async (accept) => {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept,
      },
    });
    const text = await response.text();
    const data = safeJsonParse(text || "{}", {});
    return { response, data };
  };

  let result = await request(`application/json; rfms=${resource}.v4.0`);
  if (result.response.status === 401 && !options.forceToken) {
    await scaniaToken(company, true);
    return scaniaGet(company, resource, params, { ...options, forceToken: true });
  }
  if (result.response.status === 406) result = await request("application/json");
  if (result.response.status === 429) {
    throw new Error(`Limite de requisicoes da Scania atingido em ${company.empresa}.`);
  }
  if (!result.response.ok) {
    throw new Error(result.data.error || result.data.message || `Scania ${resource} respondeu ${result.response.status}.`);
  }
  return result.data;
}

function listFrom(payload, envelope, key) {
  const wrapped = payload?.[envelope]?.[key];
  const direct = payload?.[key];
  if (Array.isArray(wrapped)) return wrapped;
  if (Array.isArray(direct)) return direct;
  return [];
}

function vehiclesFrom(payload) {
  return listFrom(payload, "vehicleResponse", "vehicles");
}

function positionsFrom(payload) {
  return listFrom(payload, "vehiclePositionResponse", "vehiclePositions");
}

function statusesFrom(payload) {
  return listFrom(payload, "vehicleStatusResponse", "vehicleStatuses");
}

function vinOf(item) {
  return String(item?.vin || item?.vehicle?.vin || item?.vehicleIdentificationNumber || "").trim();
}

function dateOf(item) {
  const raw =
    item?.receivedDateTime ||
    item?.createdDateTime ||
    item?.gnssPosition?.positionDateTime ||
    item?.snapshotDateTime ||
    item?.triggerTime ||
    "";
  if (!raw) return null;
  const normalized = /[zZ]|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestByVin(rows) {
  const map = new Map();
  for (const row of rows) {
    const vin = vinOf(row);
    if (!vin) continue;
    const current = map.get(vin);
    const rowTime = dateOf(row)?.getTime() || 0;
    const currentTime = current ? dateOf(current)?.getTime() || 0 : -1;
    if (!current || rowTime >= currentTime) map.set(vin, row);
  }
  return map;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function kmFromMeters(value) {
  const parsed = number(value);
  return parsed === null ? null : parsed / 1000;
}

function litersFromMl(value) {
  const parsed = number(value);
  return parsed === null ? null : parsed / 1000;
}

function speedOf(position) {
  return number(position?.gnssPosition?.speed) ?? number(position?.wheelBasedSpeed) ?? 0;
}

function odometerKm(status) {
  return kmFromMeters(status?.hrTotalVehicleDistance);
}

function fuelLiters(status) {
  return litersFromMl(status?.engineTotalFuelUsed);
}

function fuelLevel(status) {
  return number(status?.snapshotData?.fuelLevel1);
}

function arlaLevel(status) {
  return number(status?.snapshotData?.catalystFuelLevel);
}

function tellTales(status) {
  const values =
    status?.uptimeData?.tellTaleInfo ||
    status?.snapshotData?.tellTaleInfo ||
    status?.tellTaleInfo ||
    [];
  return Array.isArray(values) ? values : [];
}

function alertLabels(status) {
  return tellTales(status)
    .filter((item) => ["RED", "YELLOW", "AMBER"].includes(String(item?.state || "").toUpperCase()))
    .map((item) => `${item?.tellTale || item?.name || "Luz"} ${item?.state || ""}`.trim());
}

function brazilDayStartIso(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day"), 3, 0, 0)).toISOString();
}

function plusOneSecondIso(date) {
  return new Date(date.getTime() + 1000).toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scaniaHistory(company, resource, starttime, stoptime, maxPages) {
  const collected = [];
  let cursor = starttime;
  for (let page = 0; page < maxPages; page += 1) {
    const payload = await scaniaGet(company, resource, { starttime: cursor, stoptime });
    const rows = resource === "vehiclestatuses" ? statusesFrom(payload) : positionsFrom(payload);
    if (!rows.length) break;
    collected.push(...rows);
    const latest = rows.map(dateOf).filter(Boolean).sort((a, b) => b - a)[0];
    if (!latest || rows.length < 480) break;
    cursor = plusOneSecondIso(latest);
    await sleep(120);
  }
  return collected;
}

function statusWindowStats(rows, latestStatuses) {
  const byVin = new Map();
  for (const row of [...rows, ...latestStatuses]) {
    const vin = vinOf(row);
    const date = dateOf(row);
    const km = odometerKm(row);
    const liters = fuelLiters(row);
    if (!vin || !date || km === null) continue;
    const list = byVin.get(vin) || [];
    list.push({ date, km, liters });
    byVin.set(vin, list);
  }

  const stats = new Map();
  for (const [vin, values] of byVin.entries()) {
    values.sort((a, b) => a.date - b.date);
    const first = values[0];
    const last = values[values.length - 1];
    const km = Math.max(0, last.km - first.km);
    const liters =
      first.liters !== null && last.liters !== null ? Math.max(0, last.liters - first.liters) : 0;
    stats.set(vin, {
      km,
      litros: liters,
      kmLitro: liters > 0 ? km / liters : 0,
    });
  }
  return stats;
}

function positionWindowStats(rows, latestPositions) {
  const byVin = new Map();
  for (const row of [...rows, ...latestPositions]) {
    const vin = vinOf(row);
    if (!vin) continue;
    const speed = speedOf(row);
    const stats = byVin.get(vin) || { vmax: 0, moving: 0, aboveLimit: 0 };
    stats.vmax = Math.max(stats.vmax, speed);
    if (speed > MOVING_SPEED) {
      stats.moving += 1;
      if (speed > SPEED_LIMIT) stats.aboveLimit += 1;
    }
    byVin.set(vin, stats);
  }
  for (const stats of byVin.values()) {
    stats.pctAcima = stats.moving ? (stats.aboveLimit / stats.moving) * 100 : 0;
  }
  return byVin;
}

function vehicleName(vehicle, vin) {
  return String(
    vehicle?.customerVehicleName ||
      vehicle?.name ||
      vehicle?.vehicleName ||
      vehicle?.registrationNumber ||
      vin.slice(-6)
  ).toUpperCase();
}

function registration(vehicle) {
  return String(vehicle?.registrationNumber || vehicle?.licensePlate || "").toUpperCase();
}

function companyPayload(company, raw) {
  const vehicles = vehiclesFrom(raw.vehicles);
  const latestPositions = positionsFrom(raw.positions);
  const latestStatuses = statusesFrom(raw.statuses);
  const positionMap = latestByVin(latestPositions);
  const statusMap = latestByVin(latestStatuses);
  const dailyStats = statusWindowStats(raw.dailyStatuses, latestStatuses);
  const speedStats = positionWindowStats(raw.positionHistory, latestPositions);

  const seenVins = new Set([
    ...vehicles.map(vinOf),
    ...latestPositions.map(vinOf),
    ...latestStatuses.map(vinOf),
  ].filter(Boolean));

  return [...seenVins].map((vin) => {
    const vehicle = vehicles.find((item) => vinOf(item) === vin) || {};
    const position = positionMap.get(vin) || {};
    const status = statusMap.get(vin) || {};
    const speed = speedOf(position);
    const day = dailyStats.get(vin) || { km: 0, litros: 0, kmLitro: 0 };
    const picos = speedStats.get(vin) || { vmax: speed, pctAcima: speed > SPEED_LIMIT ? 100 : 0 };
    const alerts = alertLabels(status);
    const name = vehicleName(vehicle, vin);
    const plate = registration(vehicle);
    const updatedAt = dateOf(position) || dateOf(status) || new Date();

    return {
      vin,
      empresa: company.empresa,
      nome: name,
      motorista: name,
      placa: name,
      cavalo: plate,
      cavalo_trator: plate,
      placa_cavalo: plate,
      registrationNumber: plate,
      status: speed > MOVING_SPEED ? "RODANDO" : "PARADO",
      velocidade: Math.round(speed),
      diesel_pct: fuelLevel(status),
      arla_pct: arlaLevel(status),
      km_dia: day.km,
      litros_dia: day.litros,
      km_litro: day.kmLitro,
      odometro_km: odometerKm(status),
      latitude: number(position?.gnssPosition?.latitude),
      longitude: number(position?.gnssPosition?.longitude),
      atualizado_em: updatedAt.toISOString(),
      alertas: alerts,
      vmax24: picos.vmax,
      pct_acima_100: picos.pctAcima,
    };
  });
}

function aggregateCompanies(vehicles) {
  const byCompany = new Map();
  for (const vehicle of vehicles) {
    const current = byCompany.get(vehicle.empresa) || {
      empresa: vehicle.empresa,
      veiculos: 0,
      rodando: 0,
      parados: 0,
      km_dia: 0,
      litros_dia: 0,
      alertas: 0,
    };
    current.veiculos += 1;
    current.rodando += String(vehicle.status || "").includes("ROD") ? 1 : 0;
    current.parados += String(vehicle.status || "").includes("PAR") ? 1 : 0;
    current.km_dia += Number(vehicle.km_dia || 0);
    current.litros_dia += Number(vehicle.litros_dia || 0);
    current.alertas += vehicle.alertas?.length || 0;
    byCompany.set(vehicle.empresa, current);
  }
  return [...byCompany.values()].map((item) => ({
    ...item,
    km_litro: item.litros_dia ? item.km_dia / item.litros_dia : 0,
  }));
}

function buildDashboardShape(companyResults) {
  const vehicles = companyResults.flat();
  const companies = aggregateCompanies(vehicles);
  const totals = companies.reduce(
    (sum, item) => ({
      veiculos: sum.veiculos + item.veiculos,
      rodando: sum.rodando + item.rodando,
      parados: sum.parados + item.parados,
      km_dia: sum.km_dia + item.km_dia,
      litros_dia: sum.litros_dia + item.litros_dia,
      alertas: sum.alertas + item.alertas,
    }),
    { veiculos: 0, rodando: 0, parados: 0, km_dia: 0, litros_dia: 0, alertas: 0 }
  );
  totals.km_litro = totals.litros_dia ? totals.km_dia / totals.litros_dia : 0;

  const mediasVeiculos = {};
  for (const vehicle of vehicles) {
    mediasVeiculos[vehicle.vin] = {
      empresa: vehicle.empresa,
      nome: vehicle.nome,
      placa: vehicle.registrationNumber,
      km_dia: vehicle.km_dia,
      litros_dia: vehicle.litros_dia,
      km_litro: vehicle.km_litro,
      picos: {
        "24h": {
          vmax: vehicle.vmax24 || 0,
          pct_acima: vehicle.pct_acima_100 || 0,
        },
      },
    };
  }

  return {
    frota: {
      fonte: "SCANIA_RFMS",
      gerado_em: new Date().toISOString(),
      totais: totals,
      empresas: companies,
      veiculos: vehicles,
      alertas: vehicles.flatMap((vehicle) =>
        (vehicle.alertas || []).map((alerta) => ({
          empresa: vehicle.empresa,
          vin: vehicle.vin,
          placa: vehicle.registrationNumber,
          nome: vehicle.nome,
          mensagem: alerta,
        }))
      ),
    },
    medias: {
      fonte: "SCANIA_RFMS",
      gerado_em: new Date().toISOString(),
      empresas: companies,
      por_empresa: Object.fromEntries(companies.map((item) => [item.empresa, item])),
      veiculos: mediasVeiculos,
    },
  };
}

function filterTorreData(frota, medias, access) {
  if (access.all) return { frota, medias };

  const allowedVehicles = Array.isArray(frota?.veiculos)
    ? frota.veiculos.filter((vehicle) => companyAllowed(vehicle.empresa, access.companies))
    : [];
  const allowedVins = new Set(allowedVehicles.map((vehicle) => vehicle.vin).filter(Boolean));
  const litros = allowedVehicles.reduce((sum, vehicle) => sum + Number(vehicle.litros_dia || 0), 0);
  const km = allowedVehicles.reduce((sum, vehicle) => sum + Number(vehicle.km_dia || 0), 0);
  const alertas = Array.isArray(frota?.alertas)
    ? frota.alertas.filter((alerta) => companyAllowed(alerta.empresa, access.companies))
    : [];

  const filteredFrota = {
    ...frota,
    veiculos: allowedVehicles,
    alertas,
    empresas: Array.isArray(frota?.empresas)
      ? frota.empresas.filter((empresa) => companyAllowed(empresa.empresa || empresa.nome, access.companies))
      : frota?.empresas,
    totais: {
      ...(frota?.totais || {}),
      veiculos: allowedVehicles.length,
      rodando: allowedVehicles.filter((vehicle) => String(vehicle.status || "").toUpperCase().includes("ROD")).length,
      parados: allowedVehicles.filter((vehicle) => String(vehicle.status || "").toUpperCase().includes("PAR")).length,
      km_dia: km,
      litros_dia: litros,
      km_litro: litros ? km / litros : 0,
      alertas: alertas.length || allowedVehicles.reduce((sum, vehicle) => sum + (vehicle.alertas?.length || 0), 0),
    },
  };

  const mediaVehicles = {};
  for (const [vin, value] of Object.entries(medias?.veiculos || {})) {
    if (allowedVins.has(vin)) mediaVehicles[vin] = value;
  }

  const filteredMedias = {
    ...medias,
    veiculos: mediaVehicles,
    empresas: Array.isArray(medias?.empresas)
      ? medias.empresas.filter((empresa) => companyAllowed(empresa.empresa || empresa.nome, access.companies))
      : medias?.empresas,
    por_empresa: medias?.por_empresa
      ? Object.fromEntries(
          Object.entries(medias.por_empresa).filter(([empresa]) => companyAllowed(empresa, access.companies))
        )
      : medias?.por_empresa,
  };

  return { frota: filteredFrota, medias: filteredMedias };
}

async function cachedFullData() {
  const seconds = Number(env("SCANIA_CACHE_SECONDS") || 120);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  try {
    const store = getStore({ name: "taz-scania-cache", consistency: "strong" });
    const cached = await store.get("torre/latest", { type: "json", consistency: "strong" });
    if (!cached?.cachedAt || !cached?.data) return null;
    if (Date.now() - new Date(cached.cachedAt).getTime() > seconds * 1000) return null;
    return { ...cached.data, cachedAt: cached.cachedAt, cache: true };
  } catch {
    return null;
  }
}

async function saveFullData(data) {
  try {
    const store = getStore({ name: "taz-scania-cache", consistency: "strong" });
    await store.setJSON("torre/latest", { cachedAt: new Date().toISOString(), data });
  } catch {
    // Cache e apenas uma protecao contra excesso de requisicoes.
  }
}

async function loadScaniaData() {
  const cached = await cachedFullData();
  if (cached) return cached;

  const companies = scaniaCompanies();
  if (!companies.length) {
    throw new Error("Credenciais Scania/rFMS nao configuradas no Netlify.");
  }

  const now = new Date();
  const stop = now.toISOString();
  const dayStart = brazilDayStartIso(now);
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const maxPages = Math.max(1, Math.min(12, Number(env("SCANIA_HISTORY_MAX_PAGES") || 6)));

  const results = [];
  for (const company of companies) {
    const [vehicles, positions, statuses, dailyStatuses, positionHistory] = await Promise.all([
      scaniaGet(company, "vehicles"),
      scaniaGet(company, "vehiclepositions", { latestOnly: "true" }),
      scaniaGet(company, "vehiclestatuses", { latestOnly: "true" }),
      scaniaHistory(company, "vehiclestatuses", dayStart, stop, maxPages),
      scaniaHistory(company, "vehiclepositions", last24h, stop, maxPages),
    ]);
    results.push(companyPayload(company, { vehicles, positions, statuses, dailyStatuses, positionHistory }));
    await sleep(150);
  }

  const data = buildDashboardShape(results);
  await saveFullData(data);
  return data;
}

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Metodo nao permitido." });
  }

  const access = await dashboardAccess(request);
  if (access.error) return access.error;

  try {
    const data = await loadScaniaData();
    const filtered = filterTorreData(data.frota, data.medias, access);

    return json(200, {
      ok: true,
      source: "SCANIA_RFMS",
      generatedAt: new Date().toISOString(),
      cachedAt: data.cachedAt || null,
      cache: Boolean(data.cache),
      access: {
        role: access.role,
        companies: access.companies,
        all: access.all,
      },
      frota: filtered.frota,
      medias: filtered.medias,
    });
  } catch (error) {
    console.error("Scania/rFMS integration error:", error);
    return json(502, { ok: false, error: error.message || "Falha ao consultar a Scania/rFMS." });
  }
};

export const config = { path: "/api/torre" };
