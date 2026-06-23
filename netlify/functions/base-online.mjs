import { getStore } from "@netlify/blobs";
import { authenticatedUser, canViewAll, companyAllowed, userCompanies, userRole } from "./_auth.mjs";

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

function filterRecords(records, access) {
  if (access.all) return records;
  return records.filter((record) =>
    companyAllowed(record.companyName || record.company || record.empresa, access.companies)
  );
}

function filterRegistry(items, access) {
  if (access.all) return items;
  return items.filter((item) => companyAllowed(item.company || item.empresa || item.companyName, access.companies));
}

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Metodo nao permitido." });
  }

  const access = await dashboardAccess(request);
  if (access.error) return access.error;

  try {
    const trips = getStore({ name: "taz-trips", consistency: "strong" });
    const maintenanceStore = getStore({ name: "taz-maintenance", consistency: "strong" });
    const registries = getStore({ name: "taz-registries", consistency: "strong" });
    const [allRecords, allMaintenance, allDrivers, allHorses, allTrailers] = await Promise.all([
      allJson(trips, "trip/"),
      allJson(maintenanceStore, "maintenance/"),
      allJson(registries, "drivers/"),
      allJson(registries, "horses/"),
      allJson(registries, "trailers/"),
    ]);

    const records = filterRecords(allRecords, access);
    const maintenance = filterRecords(allMaintenance, access);
    const drivers = filterRegistry(allDrivers, access);
    const horses = filterRegistry(allHorses, access);
    const trailers = filterRegistry(allTrailers, access);
    records.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    maintenance.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    return json(200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      access: {
        role: access.role,
        companies: access.companies,
        all: access.all,
      },
      records,
      maintenance,
      registries: { drivers, horses, trailers },
    });
  } catch (error) {
    console.error("Online database read error:", error);
    return json(500, { ok: false, error: "Falha ao consultar a base online." });
  }
};

export const config = { path: "/api/base-online" };
