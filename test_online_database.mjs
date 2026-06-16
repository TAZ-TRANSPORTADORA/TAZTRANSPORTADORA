import fs from "node:fs/promises";

const stores = new Map();
const storeFor = (name) => {
  if (!stores.has(name)) stores.set(name, new Map());
  const data = stores.get(name);
  return {
    async setJSON(key, value) {
      data.set(key, structuredClone(value));
      return { modified: true, etag: "test" };
    },
    async get(key) {
      return data.has(key) ? structuredClone(data.get(key)) : null;
    },
    list({ prefix = "", paginate = false } = {}) {
      const blobs = [...data.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key }));
      if (paginate) {
        return {
          async *[Symbol.asyncIterator]() {
            yield { blobs };
          },
        };
      }
      return Promise.resolve({ blobs });
    },
  };
};

globalThis.getStore = ({ name }) => storeFor(name);
globalThis.authenticatedUser = async () => ({
  id: "user-test",
  email: "admin@taz.test",
  user_metadata: { role: "admin", display_name: "Administrador" },
});
globalThis.userRole = (user) => user?.user_metadata?.role || "motorista";
globalThis.Netlify = {
  env: {
    get(key) {
      if (key === "TAZ_ADMIN_KEY") return "admin-test";
      return undefined;
    },
  },
};

async function loadFunction(path) {
  let source = await fs.readFile(path, "utf8");
  source = source.replace(
    'import { getStore } from "@netlify/blobs";',
    "const getStore = globalThis.getStore;",
  );
  source = source.replace(
    'import { authenticatedUser } from "./_auth.mjs";',
    "const authenticatedUser = globalThis.authenticatedUser;",
  );
  source = source.replace(
    'import { authenticatedUser, userRole } from "./_auth.mjs";',
    "const authenticatedUser = globalThis.authenticatedUser; const userRole = globalThis.userRole;",
  );
  return import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${crypto.randomUUID()}`,
  );
}

const root =
  "C:/Users/Neo Loc/Documents/Codex/2026-06-10/ol-vamos-iniciar-um-novo-projeto";
const tripsFn = await loadFunction(`${root}/netlify/functions/sync-excel.mjs`);
const registryFn = await loadFunction(`${root}/netlify/functions/sync-cadastros.mjs`);
const baseFn = await loadFunction(`${root}/netlify/functions/base-online.mjs`);

const record = {
  id: "12345678-test",
  createdAt: "2026-06-12T10:00:00.000Z",
  tripDate: "2026-06-12",
  driverName: "CARLOS",
  horsePlate: "ABC1D23",
  trailerPlate: "DEF4G56",
  companyName: "TAZ",
  vehicleCategory: "BITRUCK",
  vehicleCash: "500",
  startKm: "1000",
  finalKm: "1500",
  fuels: [{ number: 1, km: "1200", liters: "200", value: "1200", invoiceKey: "456" }],
};

const tripResponse = await tripsFn.default(
  new Request("https://site.test/api/sync-excel", {
    method: "POST",
    headers: { authorization: "Bearer test" },
    body: JSON.stringify({ record }),
  }),
);
const tripResult = await tripResponse.json();
if (!tripResult.ok || !tripResult.stored) throw new Error("Trip save failed");

const item = {
  id: "driver-12345678",
  name: "CARLOS",
  company: "TAZ",
  category: "BITRUCK",
  active: true,
  updatedAt: "2026-06-12T10:00:00.000Z",
};
const registryResponse = await registryFn.default(
  new Request("https://site.test/api/sync-cadastros", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test" },
    body: JSON.stringify({ operation: "upsert", type: "drivers", item }),
  }),
);
if (!(await registryResponse.json()).ok) throw new Error("Registry save failed");

const baseResponse = await baseFn.default(
  new Request("https://site.test/api/base-online", {
    method: "POST",
    headers: { "x-taz-admin-key": "admin-test" },
  }),
);
const base = await baseResponse.json();
if (!base.ok || base.records.length !== 1 || base.registries.drivers.length !== 1) {
  throw new Error(`Base read failed: ${JSON.stringify(base)}`);
}

globalThis.authenticatedUser = async () => ({
  id: "driver-test",
  email: "motorista@taz.test",
  user_metadata: { role: "motorista" },
});
const driverRegistryFn = await loadFunction(`${root}/netlify/functions/sync-cadastros.mjs`);
const forbiddenResponse = await driverRegistryFn.default(
  new Request("https://site.test/api/sync-cadastros", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test" },
    body: JSON.stringify({ operation: "upsert", type: "drivers", item }),
  }),
);
if (forbiddenResponse.status !== 403) throw new Error("Driver registry write was not blocked");

console.log("Online database integration tests OK");
