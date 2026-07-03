import { authenticatedUser, canViewAll, companyAllowed, userCompanies, userRole } from "./_auth.mjs";

const MOVING_SPEED = 3;
const LOCAL_TZ_OFFSET = "-03:00";

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

function supabaseUrl() {
  return (env("SUPABASE_URL") || "https://txwsqgojfaiivpffgclw.supabase.co").replace(/\/+$/, "");
}

function supabaseSecretKey() {
  return env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY");
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function supabaseRest(path, options = {}) {
  const key = supabaseSecretKey();
  if (!key) throw new Error("Supabase service key nao configurada.");
  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? safeJsonParse(text, text) : null;
  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : data?.message || `Supabase respondeu ${response.status}.`);
  }
  return data;
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

function plateKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function localDayStart(day) {
  return new Date(`${day}T00:00:00${LOCAL_TZ_OFFSET}`);
}

function localDayEnd(day) {
  return new Date(`${day}T23:59:59${LOCAL_TZ_OFFSET}`);
}

function minutesBetween(start, end) {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 60000);
}

function timeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function locationLabel(row) {
  const raw = row?.raw || {};
  const city =
    raw.cidade ||
    raw.cidade_uf ||
    raw.local ||
    raw.address ||
    raw.endereco ||
    row?.city ||
    row?.cidade ||
    "";
  if (city) return String(city);
  const lat = numberOrNull(row?.latitude);
  const lon = numberOrNull(row?.longitude);
  if (lat !== null && lon !== null) return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  return row?.company || "-";
}

function rowMatchesPlate(row, wanted) {
  return [row?.horse_plate, row?.plate, row?.vehicle_name, row?.vin].some((value) => plateKey(value) === wanted);
}

function routePoints(rows) {
  return rows
    .map((row) => ({
      at: row.captured_at,
      time: timeLabel(row.captured_at),
      latitude: numberOrNull(row.latitude),
      longitude: numberOrNull(row.longitude),
      speedKmh: numberOrNull(row.speed_kmh) || 0,
      status: row.status || "",
      location: locationLabel(row),
    }))
    .filter((point) => point.latitude !== null && point.longitude !== null);
}

function buildSegments(rows) {
  const segments = [];
  for (let index = 0; index < rows.length - 1; index += 1) {
    const current = rows[index];
    const next = rows[index + 1];
    const minutes = minutesBetween(current.captured_at, next.captured_at);
    if (!minutes) continue;
    const speed = numberOrNull(current.speed_kmh) || 0;
    segments.push({
      startAt: current.captured_at,
      endAt: next.captured_at,
      startLabel: timeLabel(current.captured_at),
      endLabel: timeLabel(next.captured_at),
      minutes,
      moving: speed > MOVING_SPEED,
      speedKmh: speed,
      location: locationLabel(current),
    });
  }
  return segments;
}

function buildStops(segments) {
  const stops = [];
  let current = null;
  for (const segment of segments) {
    if (!segment.moving) {
      if (!current) {
        current = {
          startAt: segment.startAt,
          endAt: segment.endAt,
          minutes: 0,
          location: segment.location,
          type: "PARADA",
        };
      }
      current.endAt = segment.endAt;
      current.minutes += segment.minutes;
      continue;
    }
    if (current && current.minutes >= 40) stops.push({ ...current, number: stops.length + 1 });
    current = null;
  }
  if (current && current.minutes >= 40) stops.push({ ...current, number: stops.length + 1 });
  return stops.map((stop) => ({
    ...stop,
    startLabel: timeLabel(stop.startAt),
    endLabel: timeLabel(stop.endAt),
  }));
}

function distanceFromOdometer(rows) {
  const odometerRows = rows.filter((row) => numberOrNull(row.odometer_km) !== null);
  if (odometerRows.length < 2) return 0;
  const first = numberOrNull(odometerRows[0].odometer_km);
  const last = numberOrNull(odometerRows[odometerRows.length - 1].odometer_km);
  const distance = last - first;
  return distance > 0 ? distance : 0;
}

function topSpeeds(rows) {
  return rows
    .map((row) => ({
      at: row.captured_at,
      time: timeLabel(row.captured_at),
      speedKmh: numberOrNull(row.speed_kmh) || 0,
      location: locationLabel(row),
    }))
    .filter((item) => item.speedKmh > 0)
    .sort((a, b) => b.speedKmh - a.speedKmh)
    .slice(0, 5);
}

function thresholdMinutes(segments) {
  const result = { 80: 0, 90: 0, 100: 0, 120: 0 };
  for (const segment of segments) {
    for (const limit of Object.keys(result)) {
      if ((segment.speedKmh || 0) > Number(limit)) result[limit] += segment.minutes;
    }
  }
  return result;
}

function buildAnalysis(report) {
  const analysis = [];
  if (report.distanceKm > 0) {
    analysis.push(`Distancia registrada pela Torre: ${report.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km.`);
  }
  if (report.stops.length) {
    analysis.push(`${report.stops.length} parada(s) acima de 40 minutos, totalizando ${minutesText(report.stoppedMinutes)} parado.`);
  } else {
    analysis.push("Nenhuma parada acima de 40 minutos encontrada no periodo.");
  }
  if (report.maxSpeedKmh > 0) analysis.push(`Maior velocidade registrada: ${Math.round(report.maxSpeedKmh)} km/h.`);
  if (report.thresholds[100] > 0) analysis.push(`Tempo acima de 100 km/h: ${minutesText(report.thresholds[100])}.`);
  if (report.samples < 4) analysis.push("Relatorio com poucas leituras no dia; os tempos podem ficar aproximados.");
  return analysis;
}

function minutesText(value) {
  const minutes = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}min`;
  return `${hours}h${String(rest).padStart(2, "0")}min`;
}

function buildReport({ rows, plate, date }) {
  const sorted = [...rows].sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));
  const segments = buildSegments(sorted);
  const movingMinutes = segments.filter((segment) => segment.moving).reduce((sum, segment) => sum + segment.minutes, 0);
  const stoppedMinutes = segments.filter((segment) => !segment.moving).reduce((sum, segment) => sum + segment.minutes, 0);
  const maxSpeedKmh = sorted.reduce((max, row) => Math.max(max, numberOrNull(row.speed_kmh) || 0), 0);
  const first = sorted[0] || {};
  const last = sorted[sorted.length - 1] || {};
  const report = {
    plate,
    date,
    company: first.company || "",
    vehicleName: first.vehicle_name || first.plate || first.vin || plate,
    vin: first.vin || "",
    startAt: first.captured_at || null,
    endAt: last.captured_at || null,
    startLabel: first.captured_at ? timeLabel(first.captured_at) : "-",
    endLabel: last.captured_at ? timeLabel(last.captured_at) : "-",
    samples: sorted.length,
    distanceKm: distanceFromOdometer(sorted),
    movingMinutes,
    stoppedMinutes,
    totalMinutes: movingMinutes + stoppedMinutes,
    maxSpeedKmh,
    thresholds: thresholdMinutes(segments),
    stops: buildStops(segments),
    topSpeeds: topSpeeds(sorted),
    points: routePoints(sorted),
    segments,
    dieselPct: numberOrNull(last.diesel_pct),
    arlaPct: numberOrNull(last.arla_pct),
    odometerKm: numberOrNull(last.odometer_km),
  };
  return { ...report, analysis: buildAnalysis(report) };
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { ok: false, error: "Metodo nao permitido." });

  try {
    const access = await dashboardAccess(request);
    if (access.error) return access.error;

    const body = safeJsonParse(await request.text(), {});
    const plate = plateKey(body.plate);
    const date = String(body.date || "").slice(0, 10);
    if (!plate) return json(400, { ok: false, error: "Informe a placa do cavalo." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(400, { ok: false, error: "Informe uma data valida." });

    const start = localDayStart(date).toISOString();
    const end = localDayEnd(date).toISOString();
    const rows =
      (await supabaseRest(
        `torre_snapshots?select=*&captured_at=gte.${encodeURIComponent(start)}&captured_at=lte.${encodeURIComponent(
          end,
        )}&order=captured_at.asc&limit=5000`,
      )) || [];

    const filtered = rows.filter((row) => {
      if (!rowMatchesPlate(row, plate)) return false;
      return access.all || companyAllowed(row.company, access.companies);
    });

    if (!filtered.length) {
      return json(404, {
        ok: false,
        error: "Nao encontrei historico da Torre para essa placa nessa data.",
      });
    }

    return json(200, { ok: true, report: buildReport({ rows: filtered, plate, date }) });
  } catch (error) {
    return json(500, { ok: false, error: error.message || "Falha ao montar relatorio da Torre." });
  }
};

export const config = { path: "/api/torre-relatorio" };
