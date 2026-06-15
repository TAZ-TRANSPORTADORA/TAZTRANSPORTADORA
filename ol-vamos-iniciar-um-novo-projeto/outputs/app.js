const SUPABASE_URL = "https://txwsqgojfaiivpffgclw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_GiOI31fiyA37jAGoOJyKuA_bovc7GwN";
const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

const authShell = document.querySelector("#authShell");
const appShell = document.querySelector("#appShell");
const loginForm = document.querySelector("#loginForm");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const loginButton = document.querySelector("#loginButton");
const forgotPasswordButton = document.querySelector("#forgotPasswordButton");
const authStatus = document.querySelector("#authStatus");
const logoutButton = document.querySelector("#logoutButton");
const currentUserName = document.querySelector("#currentUserName");
const currentUserRole = document.querySelector("#currentUserRole");
const form = document.querySelector("#tripForm");
const recordsList = document.querySelector("#recordsList");
const toast = document.querySelector("#toast");
const scannerDialog = document.querySelector("#scannerDialog");
const scannerVideo = document.querySelector("#scannerVideo");
const scannerStatus = document.querySelector("#scannerStatus");
const closeScanner = document.querySelector("#closeScanner");
const clearButton = document.querySelector("#clearButton");
const exportButton = document.querySelector("#exportButton");
const themeToggle = document.querySelector("#themeToggle");
const themeToggleText = document.querySelector("#themeToggleText");
const addFuelButton = document.querySelector("#addFuelButton");
const fuelEntries = document.querySelector("#fuelEntries");
const excelBaseInput = document.querySelector("#excelBaseInput");
const updateExcelButton = document.querySelector("#updateExcelButton");
const excelStatus = document.querySelector("#excelStatus");
const adminKeyInput = document.querySelector("#adminKeyInput");
const downloadOnlineBaseButton = document.querySelector("#downloadOnlineBaseButton");
const syncPendingButton = document.querySelector("#syncPendingButton");
const syncStatus = document.querySelector("#syncStatus");
const appTabs = document.querySelectorAll("[data-app-tab]");
const appTabPanels = document.querySelectorAll(".app-tab-panel");
const registryTabs = document.querySelectorAll("[data-registry-type]");
const registryForm = document.querySelector("#registryForm");
const registryId = document.querySelector("#registryId");
const registryName = document.querySelector("#registryName");
const registryNameLabel = document.querySelector("#registryNameLabel");
const registryCompany = document.querySelector("#registryCompany");
const registryCategory = document.querySelector("#registryCategory");
const registryCompanyField = document.querySelector("#registryCompanyField");
const registryCategoryField = document.querySelector("#registryCategoryField");
const cancelRegistryButton = document.querySelector("#cancelRegistryButton");
const refreshRegistryButton = document.querySelector("#refreshRegistryButton");
const registryStatus = document.querySelector("#registryStatus");
const registryList = document.querySelector("#registryList");
const driverOptions = document.querySelector("#driverOptions");
const horsePlateOptions = document.querySelector("#horsePlateOptions");
const trailerPlateOptions = document.querySelector("#trailerPlateOptions");

const storageKey = "taz-trip-records";
const themeStorageKey = "taz-theme";
const registryStorageKey = "taz-registries";
let records = JSON.parse(localStorage.getItem(storageKey) || "[]");
let registries = loadRegistries();
let stream = null;
let scanTimer = null;
let activeScanTarget = null;
let fuelEntryCount = 0;
let activeRegistryType = "drivers";
let currentSession = null;
let currentUser = null;

function userRole(user) {
  return String(user?.user_metadata?.role || "motorista").toLowerCase();
}

function isAdmin() {
  return userRole(currentUser) === "admin";
}

function accessToken() {
  return currentSession?.access_token || "";
}

function authHeaders(extra = {}) {
  return {
    ...extra,
    authorization: `Bearer ${accessToken()}`,
  };
}

function applyUserAccess(session) {
  currentSession = session;
  currentUser = session?.user || null;
  const authenticated = Boolean(currentUser);
  authShell.hidden = authenticated;
  appShell.hidden = !authenticated;

  if (!authenticated) return;

  const role = userRole(currentUser);
  currentUserName.textContent =
    currentUser.user_metadata?.display_name ||
    currentUser.user_metadata?.name ||
    currentUser.email;
  currentUserRole.textContent = role === "admin" ? "Administrador" : "Motorista";
  document.querySelectorAll(".admin-only").forEach((element) => {
    element.hidden = role !== "admin";
  });
  document.querySelector(".app-tabs").classList.toggle("single-tab", role !== "admin");

  if (role !== "admin" && document.querySelector("#registryPanel").classList.contains("active")) {
    document.querySelector('[data-app-tab="tripPanel"]').click();
  }

  if (location.protocol.startsWith("http") && navigator.onLine) {
    window.setTimeout(syncPendingRecords, 600);
    window.setTimeout(refreshRegistries, 1000);
  }
}

async function initializeAuth() {
  if (!supabaseClient) {
    authStatus.textContent = "Não foi possível carregar o serviço de login.";
    return;
  }
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) authStatus.textContent = error.message;
  applyUserAccess(data.session);
}

function registrySeed() {
  const item = (id, name, company = "", category = "") => ({
    id,
    name,
    company,
    category,
    active: true,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending",
  });

  return {
    drivers: [],
    horses: [
      item("horse-taz1a23", "TAZ1A23"),
      item("horse-taz2b34", "TAZ2B34"),
      item("horse-taz3c45", "TAZ3C45"),
    ],
    trailers: [
      item("trailer-car1d23", "CAR1D23"),
      item("trailer-car2e34", "CAR2E34"),
      item("trailer-car3f45", "CAR3F45"),
    ],
  };
}

function loadRegistries() {
  try {
    const saved = JSON.parse(localStorage.getItem(registryStorageKey) || "null");
    if (saved?.drivers && saved?.horses && saved?.trailers) return saved;
  } catch {
    // Fall back to the initial suggestions.
  }
  return registrySeed();
}

function saveRegistries() {
  localStorage.setItem(registryStorageKey, JSON.stringify(registries));
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-theme", isDark);
  themeToggleText.textContent = isDark ? "Claro" : "Escuro";
  themeToggle.setAttribute("aria-label", isDark ? "Ativar tema claro" : "Ativar tema escuro");
  document.querySelector('meta[name="theme-color"]').setAttribute("content", isDark ? "#081522" : "#004b8d");
}

function initialTheme() {
  const savedTheme = localStorage.getItem(themeStorageKey);
  if (savedTheme) return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

applyTheme(initialTheme());

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) {
    authStatus.textContent = "Serviço de login indisponível. Verifique a internet.";
    return;
  }
  loginButton.disabled = true;
  authStatus.textContent = "Entrando...";
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: loginEmail.value.trim(),
    password: loginPassword.value,
  });
  loginButton.disabled = false;

  if (error) {
    authStatus.textContent =
      error.message === "Invalid login credentials"
        ? "E-mail ou senha incorretos."
        : error.message;
    return;
  }

  loginForm.reset();
  authStatus.textContent = "Acesso autorizado.";
  applyUserAccess(data.session);
  window.setTimeout(syncPendingRecords, 500);
});

forgotPasswordButton.addEventListener("click", async () => {
  if (!supabaseClient) {
    authStatus.textContent = "Serviço de login indisponível.";
    return;
  }
  const email = loginEmail.value.trim();
  if (!email) {
    authStatus.textContent = "Digite seu e-mail para receber a recuperação.";
    return;
  }
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${window.location.pathname}`,
  });
  authStatus.textContent = error
    ? error.message
    : "Enviamos as instruções de recuperação para seu e-mail.";
});

logoutButton.addEventListener("click", async () => {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  applyUserAccess(null);
  authStatus.textContent = "Sessão encerrada.";
});

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    applyUserAccess(session);
  });
}

themeToggle.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("dark-theme") ? "light" : "dark";
  localStorage.setItem(themeStorageKey, nextTheme);
  applyTheme(nextTheme);
});

appTabs.forEach((button) => {
  button.addEventListener("click", () => {
    appTabs.forEach((tab) => tab.classList.toggle("active", tab === button));
    appTabPanels.forEach((panel) =>
      panel.classList.toggle("active", panel.id === button.dataset.appTab)
    );
  });
});

registryTabs.forEach((button) => {
  button.addEventListener("click", () => {
    activeRegistryType = button.dataset.registryType;
    renderRegistryUi();
  });
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function registryTypeConfig(type) {
  if (type === "horses") {
    return { label: "Placa do cavalo", placeholder: "Ex.: ABC1D23", title: "Cavalo" };
  }
  if (type === "trailers") {
    return { label: "Placa da carreta", placeholder: "Ex.: DEF4G56", title: "Carreta" };
  }
  return { label: "Nome do motorista", placeholder: "Digite o nome", title: "Motorista" };
}

function normalizeRegistryName(type, value) {
  const text = String(value || "").trim();
  return type === "drivers" ? text.toUpperCase() : text.toUpperCase().replace(/\s/g, "");
}

function updateRegistrySuggestions() {
  const options = (items) =>
    items
      .filter((item) => item.active)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((item) => `<option value="${escapeHtml(item.name)}"></option>`)
      .join("");

  driverOptions.innerHTML = options(registries.drivers);
  horsePlateOptions.innerHTML = options(registries.horses);
  trailerPlateOptions.innerHTML = options(registries.trailers);
}

function resetRegistryForm() {
  registryForm.reset();
  registryId.value = "";
  cancelRegistryButton.hidden = true;
  const config = registryTypeConfig(activeRegistryType);
  registryNameLabel.textContent = config.label;
  registryName.placeholder = config.placeholder;
  const isDriver = activeRegistryType === "drivers";
  registryCompanyField.hidden = !isDriver;
  registryCategoryField.hidden = !isDriver;
}

function renderRegistryList() {
  const items = [...registries[activeRegistryType]].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  if (!items.length) {
    registryList.innerHTML = '<div class="registry-empty">Nenhum cadastro encontrado.</div>';
    return;
  }

  registryList.innerHTML = items
    .map((item) => {
      const details = [item.company, item.category].filter(Boolean).join(" • ");
      return `
        <article class="registry-item ${item.active ? "" : "inactive"}">
          <div class="registry-item-main">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(details || (item.active ? "Ativo" : "Inativo"))}</span>
          </div>
          <div class="registry-item-actions">
            <button type="button" data-registry-edit="${item.id}">Editar</button>
            <button type="button" data-registry-toggle="${item.id}">
              ${item.active ? "Desativar" : "Ativar"}
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRegistryUi() {
  registryTabs.forEach((button) =>
    button.classList.toggle("active", button.dataset.registryType === activeRegistryType)
  );
  resetRegistryForm();
  renderRegistryList();
  updateRegistrySuggestions();
}

async function registryRequest(operation, item = null) {
  if (!navigator.onLine || !location.protocol.startsWith("http")) return null;
  const response = await fetch("/api/sync-cadastros", {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ operation, type: activeRegistryType, item }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || "Falha na sincronização.");
  return result;
}

async function refreshRegistries() {
  refreshRegistryButton.disabled = true;
  registryStatus.textContent = "Atualizando cadastros...";
  try {
    const result = await registryRequest("list");
    if (result?.registries) {
      registries = {
        drivers: result.registries.drivers || registries.drivers,
        horses: result.registries.horses || registries.horses,
        trailers: result.registries.trailers || registries.trailers,
      };
      saveRegistries();
      renderRegistryUi();
      registryStatus.textContent = "Cadastros atualizados para este aparelho.";
    } else {
      registryStatus.textContent = "Usando cadastros salvos neste aparelho.";
    }
  } catch (error) {
    registryStatus.textContent = `Não foi possível atualizar: ${error.message}`;
  } finally {
    refreshRegistryButton.disabled = false;
  }
}

function money(value) {
  if (!value) return "R$ 0,00";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function saveRecords() {
  localStorage.setItem(storageKey, JSON.stringify(records));
}

function syncLabel(status) {
  if (status === "synced") return ["Salvo na base online", "synced"];
  if (status === "failed") return ["Falha no envio", "failed"];
  return ["Aguardando envio", "pending"];
}

function recordForSync(record) {
  const {
    syncStatus: ignoredStatus,
    syncError: ignoredError,
    syncedAt: ignoredAt,
    centralSyncVersion: ignoredVersion,
    ...data
  } = record;
  return data;
}

async function syncRecord(recordId) {
  const index = records.findIndex((record) => record.id === recordId);
  if (
    index < 0 ||
    (records[index].syncStatus === "synced" && records[index].centralSyncVersion === 1)
  ) {
    return true;
  }

  if (!navigator.onLine || !location.protocol.startsWith("http")) {
    records[index].syncStatus = "pending";
    saveRecords();
    renderRecords();
    return false;
  }

  records[index].syncStatus = "pending";
  records[index].syncError = "";
  saveRecords();
  renderRecords();

  try {
    const response = await fetch("/api/sync-excel", {
      method: "POST",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ record: recordForSync(records[index]) }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "O servidor não confirmou o envio.");
    }

    records[index].syncStatus = "synced";
    records[index].centralSyncVersion = 1;
    records[index].syncedAt = new Date().toISOString();
    records[index].syncError = "";
    saveRecords();
    renderRecords();
    return true;
  } catch (error) {
    records[index].syncStatus = "failed";
    records[index].syncError = error.message;
    saveRecords();
    renderRecords();
    return false;
  }
}

async function syncPendingRecords() {
  const pending = records.filter(
    (record) => record.syncStatus !== "synced" || record.centralSyncVersion !== 1
  );
  if (!pending.length) {
    syncStatus.textContent = "Todos os registros deste aparelho já foram enviados.";
    return;
  }

  syncPendingButton.disabled = true;
  syncStatus.textContent = `Enviando ${pending.length} registro(s) para a base online...`;
  let sent = 0;

  for (const record of pending) {
    if (await syncRecord(record.id)) sent += 1;
  }

  const remaining = records.filter(
    (record) => record.syncStatus !== "synced" || record.centralSyncVersion !== 1
  ).length;
  syncStatus.textContent = remaining
    ? `${sent} enviado(s). ${remaining} registro(s) ainda pendente(s).`
    : `${sent} registro(s) enviado(s). Base sincronizada.`;
  syncPendingButton.disabled = false;
}

function createFuelEntry() {
  fuelEntryCount += 1;
  const entry = document.createElement("div");
  const invoiceId = `fuelInvoiceKey${fuelEntryCount}`;
  entry.className = "fuel-entry";
  entry.innerHTML = `
    <div class="fuel-entry-head">
      <strong>Abastecimento ${fuelEntryCount}</strong>
      <button class="secondary remove-fuel-button" type="button">Remover</button>
    </div>
    <label>
      KM do abastecimento
      <input class="fuel-km-input" name="fuelKm[]" type="number" min="0" inputmode="numeric" placeholder="Ex.: 125420" />
    </label>
    <label>
      Litros abastecidos
      <input class="fuel-liters-input" name="fuelLiters[]" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Ex.: 450,00" />
    </label>
    <label>
      Valor total do diesel
      <input class="fuel-value-input" name="fuelValue[]" type="number" min="0" step="0.01" inputmode="decimal" placeholder="R$ 0,00" />
    </label>
    <label>
      Chave de acesso da NF
      <div class="scan-row">
        <input id="${invoiceId}" class="fuel-invoice-input" name="fuelInvoiceKey[]" type="text" inputmode="numeric" maxlength="44" placeholder="44 dígitos" />
        <button class="icon-button" type="button" data-scan-target="${invoiceId}" aria-label="Ler chave de abastecimento pela câmera">📷</button>
      </div>
    </label>
  `;
  fuelEntries.appendChild(entry);
  updateFuelRemoveButtons();
}

function updateFuelRemoveButtons() {
  const entries = fuelEntries.querySelectorAll(".fuel-entry");
  entries.forEach((entry) => {
    const removeButton = entry.querySelector(".remove-fuel-button");
    removeButton.hidden = entries.length === 1;
  });
}

function collectFuelEntries() {
  return Array.from(fuelEntries.querySelectorAll(".fuel-entry"))
    .map((entry, index) => ({
      number: index + 1,
      km: entry.querySelector(".fuel-km-input").value,
      liters: entry.querySelector(".fuel-liters-input").value,
      value: entry.querySelector(".fuel-value-input").value,
      invoiceKey: entry.querySelector(".fuel-invoice-input").value,
    }))
    .filter((entry) => entry.km || entry.liters || entry.value || entry.invoiceKey);
}

function resetFuelEntries() {
  fuelEntries.innerHTML = "";
  fuelEntryCount = 0;
  createFuelEntry();
}

function setDefaultTripDate() {
  const field = document.querySelector("#tripDate");
  if (field && !field.value) field.value = new Date().toISOString().slice(0, 10);
}

function renderRecords() {
  if (!records.length) {
    recordsList.innerHTML = "<p>Nenhum registro salvo ainda.</p>";
    return;
  }

  recordsList.innerHTML = records
    .slice(0, 8)
    .map(
      (record) => {
        const fuels = record.fuels || [];
        const fuelSummary = fuels.length
          ? fuels
              .map(
                (fuel) =>
                  `KM ${fuel.km || "-"} / ${fuel.liters || "-"} L / ${money(fuel.value)}`
              )
              .join(" | ")
          : record.fuelKm || "-";
        const [statusText, statusClass] = syncLabel(record.syncStatus);

        return `
        <article class="record-item">
          <strong>${escapeHtml(record.driverName)} - ${escapeHtml(record.horsePlate)} / ${escapeHtml(record.trailerPlate)}</strong>
          <span>KM: ${escapeHtml(record.startKm || "-")} até ${escapeHtml(record.finalKm || "-")}</span>
          <span>Abastecimentos: ${escapeHtml(fuelSummary)}</span>
          <span>Caixinha: ${money(record.vehicleCash)} | Carga: ${escapeHtml(record.loadAmount || "-")}</span>
          <span>${new Date(record.createdAt).toLocaleString("pt-BR")}</span>
          <span class="sync-badge ${statusClass}">${statusText}</span>
        </article>
      `;
      }
    )
    .join("");
}

function formToRecord() {
  const data = new FormData(form);
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    createdByUserId: currentUser?.id || "",
    createdByEmail: currentUser?.email || "",
    horsePlate: String(data.get("horsePlate") || "").toUpperCase(),
    trailerPlate: String(data.get("trailerPlate") || "").toUpperCase(),
    driverName: data.get("driverName"),
    companyName: String(data.get("companyName") || "").toUpperCase(),
    vehicleCategory: String(data.get("vehicleCategory") || "").toUpperCase(),
    vehicleCash: data.get("vehicleCash"),
    tripDate: data.get("tripDate"),
    startKm: data.get("startKm"),
    fuels: collectFuelEntries(),
    loadAmount: data.get("loadAmount"),
    loadInvoiceKey: data.get("loadInvoiceKey"),
    finalKm: data.get("finalKm"),
  };
}

function validateKm(record) {
  const start = Number(record.startKm || 0);
  const final = Number(record.finalKm || 0);

  if (record.finalKm && final < start) return "O KM final deve ser maior ou igual ao KM inicial.";

  for (const fuel of record.fuels) {
    const fuelKm = Number(fuel.km || 0);
    if (fuel.km && fuelKm < start) return "O KM do abastecimento deve ser maior ou igual ao KM inicial.";
    if (record.finalKm && fuel.km && fuelKm > final) return "O KM do abastecimento deve ser menor ou igual ao KM final.";
  }

  return "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const record = formToRecord();
  const kmError = validateKm(record);

  if (kmError) {
    showToast(kmError);
    return;
  }

  record.syncStatus = "pending";
  records = [record, ...records];
  saveRecords();
  renderRecords();
  form.reset();
  resetFuelEntries();
  setDefaultTripDate();
  showToast("Registro salvo. Enviando para a base online...");
  const synced = await syncRecord(record.id);
  showToast(synced ? "Registro salvo na base online." : "Registro salvo no aparelho. Envio pendente.");
});

clearButton.addEventListener("click", () => {
  form.reset();
  resetFuelEntries();
  setDefaultTripDate();
  showToast("Campos limpos.");
});

addFuelButton.addEventListener("click", createFuelEntry);
syncPendingButton.addEventListener("click", syncPendingRecords);
window.addEventListener("online", syncPendingRecords);
refreshRegistryButton.addEventListener("click", refreshRegistries);
cancelRegistryButton.addEventListener("click", resetRegistryForm);

registryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = normalizeRegistryName(activeRegistryType, registryName.value);
  if (!name) return;

  const items = registries[activeRegistryType];
  const existingId = registryId.value;
  const duplicate = items.find(
    (item) => item.name === name && item.id !== existingId
  );
  if (duplicate) {
    registryStatus.textContent = "Este cadastro já existe.";
    return;
  }

  const current = items.find((item) => item.id === existingId);
  const item = {
    id: current?.id || crypto.randomUUID(),
    name,
    company: activeRegistryType === "drivers" ? registryCompany.value.trim().toUpperCase() : "",
    category: activeRegistryType === "drivers" ? registryCategory.value.trim().toUpperCase() : "",
    active: current?.active ?? true,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending",
  };

  if (current) {
    Object.assign(current, item);
  } else {
    items.push(item);
  }

  saveRegistries();
  renderRegistryUi();
  registryStatus.textContent = "Cadastro salvo neste aparelho. Sincronizando...";

  try {
    await registryRequest("upsert", item);
    item.syncStatus = "synced";
    saveRegistries();
    registryStatus.textContent = "Cadastro salvo e compartilhado.";
  } catch (error) {
    item.syncStatus = "failed";
    saveRegistries();
    registryStatus.textContent = `Cadastro local salvo. Sincronização pendente: ${error.message}`;
  }
});

registryList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-registry-edit]");
  const toggleButton = event.target.closest("[data-registry-toggle]");

  if (editButton) {
    const item = registries[activeRegistryType].find(
      (entry) => entry.id === editButton.dataset.registryEdit
    );
    if (!item) return;
    registryId.value = item.id;
    registryName.value = item.name;
    registryCompany.value = item.company || "";
    registryCategory.value = item.category || "";
    cancelRegistryButton.hidden = false;
    registryName.focus();
    return;
  }

  if (toggleButton) {
    const item = registries[activeRegistryType].find(
      (entry) => entry.id === toggleButton.dataset.registryToggle
    );
    if (!item) return;
    item.active = !item.active;
    item.updatedAt = new Date().toISOString();
    item.syncStatus = "pending";
    saveRegistries();
    renderRegistryList();
    updateRegistrySuggestions();
    registryStatus.textContent = item.active ? "Cadastro ativado." : "Cadastro desativado.";

    try {
      await registryRequest("upsert", item);
      item.syncStatus = "synced";
      saveRegistries();
    } catch (error) {
      item.syncStatus = "failed";
      saveRegistries();
      registryStatus.textContent += ` Sincronização pendente: ${error.message}`;
    }
  }
});

fuelEntries.addEventListener("click", (event) => {
  if (!event.target.classList.contains("remove-fuel-button")) return;
  event.target.closest(".fuel-entry").remove();
  updateFuelRemoveButtons();
});

function onlyDigits(text) {
  return (text || "").replace(/\D/g, "");
}

function acceptScanResult(rawValue) {
  const digits = onlyDigits(rawValue);
  const key = digits.length >= 44 ? digits.slice(0, 44) : digits;
  document.querySelector(`#${activeScanTarget}`).value = key;
  showToast(key.length === 44 ? "Chave lida com sucesso." : "Código lido. Confira a chave.");
  stopScanner();
}

async function startScanner(targetId) {
  activeScanTarget = targetId;

  if (!("BarcodeDetector" in window)) {
    showToast("Este navegador não oferece leitura automática. Digite a chave manualmente.");
    return;
  }

  try {
    scannerDialog.showModal();
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    scannerVideo.srcObject = stream;
    const detector = new BarcodeDetector({
      formats: ["qr_code", "code_128", "ean_13", "itf"],
    });

    scanTimer = window.setInterval(async () => {
      if (!scannerVideo.videoWidth) return;
      const codes = await detector.detect(scannerVideo);
      if (codes.length) acceptScanResult(codes[0].rawValue);
    }, 700);
  } catch (error) {
    scannerStatus.textContent = "Não foi possível abrir a câmera. Verifique a permissão do navegador.";
    showToast("Câmera indisponível.");
  }
}

function stopScanner() {
  if (scanTimer) window.clearInterval(scanTimer);
  scanTimer = null;
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  scannerVideo.srcObject = null;
  if (scannerDialog.open) scannerDialog.close();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-scan-target]");
  if (!button) return;
  startScanner(button.dataset.scanTarget);
});

closeScanner.addEventListener("click", stopScanner);
scannerDialog.addEventListener("close", stopScanner);

exportButton.addEventListener("click", () => {
  if (!records.length) {
    showToast("Nenhum registro para exportar.");
    return;
  }

  const headers = Object.keys(records[0]);
  const csv = [
    headers.join(";"),
    ...records.map((record) =>
      headers
        .map((header) => {
          const value = Array.isArray(record[header]) ? JSON.stringify(record[header]) : record[header];
          return `"${String(value || "").replaceAll('"', '""')}"`;
        })
        .join(";")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "registros-taz.csv";
  link.click();
  URL.revokeObjectURL(url);
});

function sheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  return sheet ? XLSX.utils.sheet_to_json(sheet, { defval: "" }) : [];
}

function replaceSheet(workbook, sheetName, rows, headers) {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  sheet["!cols"] = headers.map((header) => ({
    wch: Math.min(48, Math.max(12, header.length + 2)),
  }));
  workbook.Sheets[sheetName] = sheet;
  if (!workbook.SheetNames.includes(sheetName)) workbook.SheetNames.push(sheetName);
}

function recordDate(record) {
  if (record.tripDate) return new Date(`${record.tripDate}T12:00:00`);
  return new Date(record.createdAt);
}

function tripExcelRow(record) {
  const startKm = Number(record.startKm || 0);
  const finalKm = Number(record.finalKm || 0);
  const date = recordDate(record);

  return {
    ID: record.id,
    DataHora: record.createdAt,
    Data: date.toLocaleDateString("pt-BR"),
    Motorista: String(record.driverName || "").toUpperCase(),
    Empresa: record.companyName || "",
    "Placa Cavalo": record.horsePlate || "",
    "Placa Carreta": record.trailerPlate || "",
    Categoria: record.vehicleCategory || "",
    "KM Inicial": startKm || "",
    "KM Final": finalKm || "",
    "KM Rodado": finalKm >= startKm ? finalKm - startKm : "",
    Caixinha: Number(record.vehicleCash || 0),
    "Quantidade Carregada": Number(record.loadAmount || 0),
    "Chave NF Carregamento": record.loadInvoiceKey || "",
  };
}

function fuelExcelRows(record) {
  const date = recordDate(record);
  return (record.fuels || []).map((fuel, index) => ({
    ID: `${record.id}-AB${index + 1}`,
    "Viagem ID": record.id,
    DataHora: record.createdAt,
    Data: date.toLocaleDateString("pt-BR"),
    Motorista: String(record.driverName || "").toUpperCase(),
    Empresa: record.companyName || "",
    "Placa Cavalo": record.horsePlate || "",
    KM: Number(fuel.km || 0) || "",
    Litros: Number(fuel.liters || 0) || "",
    "Valor Diesel": Number(fuel.value || 0) || "",
    "Chave NF": fuel.invoiceKey || "",
  }));
}

function registryExcelRows(items, type) {
  return items.map((item) =>
    type === "drivers"
      ? {
          ID: item.id,
          Nome: item.name,
          Empresa: item.company || "",
          Categoria: item.category || "",
          Ativo: item.active ? "SIM" : "NÃO",
          "Atualizado em": item.updatedAt || "",
        }
      : {
          ID: item.id,
          Placa: item.name,
          Ativo: item.active ? "SIM" : "NÃO",
          "Atualizado em": item.updatedAt || "",
        }
  );
}

function createOnlineWorkbook(data) {
  const workbook = XLSX.utils.book_new();
  const tripRows = data.records.map(tripExcelRow);
  const fuelRows = data.records.flatMap(fuelExcelRows);
  const addSheet = (name, rows, headers) => {
    const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    sheet["!cols"] = headers.map((header) => ({
      wch: Math.min(48, Math.max(12, header.length + 2)),
    }));
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  };

  addSheet("APP_VIAGENS", tripRows, [
    "ID", "DataHora", "Data", "Motorista", "Empresa", "Placa Cavalo",
    "Placa Carreta", "Categoria", "KM Inicial", "KM Final", "KM Rodado",
    "Caixinha", "Quantidade Carregada", "Chave NF Carregamento",
  ]);
  addSheet("APP_ABASTECIMENTOS", fuelRows, [
    "ID", "Viagem ID", "DataHora", "Data", "Motorista", "Empresa",
    "Placa Cavalo", "KM", "Litros", "Valor Diesel", "Chave NF",
  ]);
  addSheet("CAD_MOTORISTAS", registryExcelRows(data.registries.drivers, "drivers"), [
    "ID", "Nome", "Empresa", "Categoria", "Ativo", "Atualizado em",
  ]);
  addSheet("CAD_CAVALOS", registryExcelRows(data.registries.horses, "horses"), [
    "ID", "Placa", "Ativo", "Atualizado em",
  ]);
  addSheet("CAD_CARRETAS", registryExcelRows(data.registries.trailers, "trailers"), [
    "ID", "Placa", "Ativo", "Atualizado em",
  ]);
  return workbook;
}

downloadOnlineBaseButton.addEventListener("click", async () => {
  const adminKey = adminKeyInput.value.trim();
  if (!adminKey) {
    excelStatus.textContent = "Digite o código administrativo.";
    return;
  }
  if (typeof XLSX === "undefined") {
    excelStatus.textContent = "O gerador de Excel não carregou.";
    return;
  }

  downloadOnlineBaseButton.disabled = true;
  excelStatus.textContent = "Reunindo os dados online...";
  try {
    const response = await fetch("/api/base-online", {
      method: "POST",
      headers: authHeaders({ "x-taz-admin-key": adminKey }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "Consulta recusada.");

    const workbook = createOnlineWorkbook(data);
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Base_TAZ_online_${stamp}.xlsx`);
    excelStatus.textContent = `Base baixada com ${data.records.length} viagem(ns).`;
  } catch (error) {
    excelStatus.textContent = `Não foi possível baixar: ${error.message}`;
  } finally {
    downloadOnlineBaseButton.disabled = false;
  }
});

updateExcelButton.addEventListener("click", async () => {
  const file = excelBaseInput.files && excelBaseInput.files[0];

  if (!file) {
    excelStatus.textContent = "Selecione primeiro a planilha consolidada.";
    return;
  }

  if (typeof XLSX === "undefined") {
    excelStatus.textContent = "O leitor de Excel não carregou. Conecte o aparelho à internet e reabra o app.";
    return;
  }

  if (!records.length) {
    excelStatus.textContent = "Não existem registros salvos neste aparelho.";
    return;
  }

  try {
    excelStatus.textContent = "Atualizando a planilha...";
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const currentTrips = sheetRows(workbook, "APP_VIAGENS");
    const currentFuels = sheetRows(workbook, "APP_ABASTECIMENTOS");
    const tripIds = new Set(currentTrips.map((row) => String(row.ID || "")));
    const fuelIds = new Set(currentFuels.map((row) => String(row.ID || "")));
    const newTrips = records.map(tripExcelRow).filter((row) => !tripIds.has(row.ID));
    const newFuels = records
      .flatMap(fuelExcelRows)
      .filter((row) => !fuelIds.has(row.ID));

    replaceSheet(
      workbook,
      "APP_VIAGENS",
      [...currentTrips, ...newTrips],
      [
        "ID",
        "DataHora",
        "Data",
        "Motorista",
        "Empresa",
        "Placa Cavalo",
        "Placa Carreta",
        "Categoria",
        "KM Inicial",
        "KM Final",
        "KM Rodado",
        "Caixinha",
        "Quantidade Carregada",
        "Chave NF Carregamento",
      ]
    );
    replaceSheet(
      workbook,
      "APP_ABASTECIMENTOS",
      [...currentFuels, ...newFuels],
      [
        "ID",
        "Viagem ID",
        "DataHora",
        "Data",
        "Motorista",
        "Empresa",
        "Placa Cavalo",
        "KM",
        "Litros",
        "Valor Diesel",
        "Chave NF",
      ]
    );

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Consolidado_TAZ_atualizado_${stamp}.xlsx`);
    excelStatus.textContent = `Planilha gerada: ${newTrips.length} viagem(ns) e ${newFuels.length} abastecimento(s) adicionados.`;
  } catch (error) {
    excelStatus.textContent = `Não foi possível atualizar a planilha: ${error.message}`;
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js");
}

resetFuelEntries();
setDefaultTripDate();
renderRecords();
renderRegistryUi();
initializeAuth();
