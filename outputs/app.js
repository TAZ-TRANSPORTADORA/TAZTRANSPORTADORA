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
const tripAccordionSections = document.querySelectorAll(".trip-accordion-section");
const recordsList = document.querySelector("#recordsList");
const recordSearchInput = document.querySelector("#recordSearchInput");
const toast = document.querySelector("#toast");
const scannerDialog = document.querySelector("#scannerDialog");
const scannerVideo = document.querySelector("#scannerVideo");
const scannerStatus = document.querySelector("#scannerStatus");
const closeScanner = document.querySelector("#closeScanner");
const clearButton = document.querySelector("#clearButton");
const saveDraftButton = document.querySelector("#saveDraftButton");
const exportButton = document.querySelector("#exportButton");
const themeToggle = document.querySelector("#themeToggle");
const themeToggleText = document.querySelector("#themeToggleText");
const addFuelButton = document.querySelector("#addFuelButton");
const fuelEntries = document.querySelector("#fuelEntries");
const addLoadButton = document.querySelector("#addLoadButton");
const loadEntries = document.querySelector("#loadEntries");
const excelBaseInput = document.querySelector("#excelBaseInput");
const updateExcelButton = document.querySelector("#updateExcelButton");
const excelStatus = document.querySelector("#excelStatus");
const adminKeyInput = document.querySelector("#adminKeyInput");
const downloadOnlineBaseButton = document.querySelector("#downloadOnlineBaseButton");
const syncPendingButton = document.querySelector("#syncPendingButton");
const syncStatus = document.querySelector("#syncStatus");
const travelExpenseReceiptInput = document.querySelector("#travelExpenseReceipt");
const travelExpenseReceiptPreview = document.querySelector("#travelExpenseReceiptPreview");
const removeTravelExpenseReceipt = document.querySelector("#removeTravelExpenseReceipt");
const maintenanceForm = document.querySelector("#maintenanceForm");
const maintenanceList = document.querySelector("#maintenanceList");
const maintenanceStatus = document.querySelector("#maintenanceStatus");
const clearMaintenanceButton = document.querySelector("#clearMaintenanceButton");
const maintenanceDate = document.querySelector("#maintenanceDate");
const maintenanceDriverName = document.querySelector("#maintenanceDriverName");
const maintenanceCompanyName = document.querySelector("#maintenanceCompanyName");
const appTabs = document.querySelectorAll("[data-app-tab]");
const appTabPanels = document.querySelectorAll(".app-tab-panel");
const registryTabs = document.querySelectorAll("[data-registry-type]");
const registryForm = document.querySelector("#registryForm");
const registryId = document.querySelector("#registryId");
const registryName = document.querySelector("#registryName");
const registryNameLabel = document.querySelector("#registryNameLabel");
const registryCompany = document.querySelector("#registryCompany");
const registryCategory = document.querySelector("#registryCategory");
const registrySalary = document.querySelector("#registrySalary");
const registryDailyRate = document.querySelector("#registryDailyRate");
const registryCommission = document.querySelector("#registryCommission");
const registryReferenceBad = document.querySelector("#registryReferenceBad");
const registryReferenceGood = document.querySelector("#registryReferenceGood");
const registryReferenceExcellent = document.querySelector("#registryReferenceExcellent");
const registryCompanyField = document.querySelector("#registryCompanyField");
const registryCategoryField = document.querySelector("#registryCategoryField");
const registrySalaryField = document.querySelector("#registrySalaryField");
const registryDailyRateField = document.querySelector("#registryDailyRateField");
const registryCommissionField = document.querySelector("#registryCommissionField");
const registryReferenceBadField = document.querySelector("#registryReferenceBadField");
const registryReferenceGoodField = document.querySelector("#registryReferenceGoodField");
const registryReferenceExcellentField = document.querySelector("#registryReferenceExcellentField");
const cancelRegistryButton = document.querySelector("#cancelRegistryButton");
const refreshRegistryButton = document.querySelector("#refreshRegistryButton");
const registryStatus = document.querySelector("#registryStatus");
const registryList = document.querySelector("#registryList");
const driverNameInput = document.querySelector("#driverName");
const driverOptions = document.querySelector("#driverOptions");
const horsePlateOptions = document.querySelector("#horsePlateOptions");
const trailerPlateOptions = document.querySelector("#trailerPlateOptions");
const fuelVehicleOptions = document.querySelector("#fuelVehicleOptions");

const storageKey = "taz-trip-records";
const maintenanceStorageKey = "taz-maintenance-records";
const themeStorageKey = "taz-theme";
const registryStorageKey = "taz-registries";
let records = JSON.parse(localStorage.getItem(storageKey) || "[]");
let maintenanceRecords = JSON.parse(localStorage.getItem(maintenanceStorageKey) || "[]");
let registries = loadRegistries();
let stream = null;
let scanTimer = null;
let activeScanTarget = null;
let fuelEntryCount = 0;
let loadEntryCount = 0;
let activeRegistryType = "drivers";
let currentSession = null;
let currentUser = null;
let editingDraftId = "";
let editingFinalizedId = "";
let pendingEditReason = "";
let travelExpenseReceipt = null;

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

function normalizeDriverLoginName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function driverNameFromLogin(user = currentUser) {
  const metadata = user?.user_metadata || {};
  const fromMetadata =
    metadata.driver_name ||
    metadata.driverName ||
    metadata.display_name ||
    metadata.name ||
    "";
  if (fromMetadata) return normalizeDriverLoginName(fromMetadata);
  return normalizeDriverLoginName(String(user?.email || "").split("@")[0].replace(/[._-]+/g, " "));
}

function driverRegistry(driverName) {
  const normalized = normalizeDriverLoginName(driverName);
  return registries.drivers.find((item) => normalizeDriverLoginName(item.name) === normalized);
}

function applyDriverLoginLock() {
  if (!driverNameInput || !currentUser) return;

  if (isAdmin()) {
    driverNameInput.readOnly = false;
    driverNameInput.classList.remove("locked-field");
    driverNameInput.placeholder = "Digite ou selecione";
    driverNameInput.title = "";
    if (maintenanceDriverName) {
      maintenanceDriverName.readOnly = false;
      maintenanceDriverName.classList.remove("locked-field");
      maintenanceDriverName.placeholder = "Digite ou selecione";
      maintenanceDriverName.title = "";
    }
    return;
  }

  const driverName = driverNameFromLogin();
  driverNameInput.value = driverName;
  driverNameInput.readOnly = true;
  driverNameInput.classList.add("locked-field");
  driverNameInput.placeholder = "Vinculado ao login";
  driverNameInput.title = "Nome vinculado ao login de acesso.";
  if (maintenanceDriverName) {
    maintenanceDriverName.value = driverName;
    maintenanceDriverName.readOnly = true;
    maintenanceDriverName.classList.add("locked-field");
    maintenanceDriverName.placeholder = "Vinculado ao login";
    maintenanceDriverName.title = "Nome vinculado ao login de acesso.";
  }

  const driver = driverRegistry(driverName);
  const companyField = form.elements.namedItem("companyName");
  const categoryField = form.elements.namedItem("vehicleCategory");
  if (driver?.company && companyField && !companyField.value) companyField.value = driver.company;
  if (driver?.category && categoryField && !categoryField.value) categoryField.value = driver.category;
  if (driver?.company && maintenanceCompanyName && !maintenanceCompanyName.value) maintenanceCompanyName.value = driver.company;
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
  document.querySelector(".app-tabs").classList.remove("single-tab");

  if (role !== "admin" && document.querySelector("#registryPanel").classList.contains("active")) {
    document.querySelector('[data-app-tab="tripPanel"]').click();
  }
  applyDriverLoginLock();

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

tripAccordionSections.forEach((section) => {
  section.addEventListener("toggle", () => {
    if (!section.open) return;
    tripAccordionSections.forEach((item) => {
      if (item !== section) item.open = false;
    });
  });
});

form.addEventListener(
  "invalid",
  (event) => {
    openTripSectionForElement(event.target);
  },
  true
);

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

function setActiveTripSection(sectionOrSelector) {
  const section =
    typeof sectionOrSelector === "string"
      ? document.querySelector(sectionOrSelector)
      : sectionOrSelector;
  if (!section) return;
  tripAccordionSections.forEach((item) => {
    item.open = item === section;
  });
}

function resetTripAccordion() {
  setActiveTripSection("#tripVehicleSection");
}

function openTripSectionForElement(element) {
  const section = element?.closest?.(".trip-accordion-section");
  if (section) setActiveTripSection(section);
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
  fuelVehicleOptions.innerHTML = options([...registries.horses, ...registries.trailers]);
  applyDriverLoginLock();
}

function resetRegistryForm() {
  registryForm.reset();
  registryId.value = "";
  cancelRegistryButton.hidden = true;
  const config = registryTypeConfig(activeRegistryType);
  registryNameLabel.textContent = config.label;
  registryName.placeholder = config.placeholder;
  const isDriver = activeRegistryType === "drivers";
  const isHorse = activeRegistryType === "horses";
  const hasCompanyCategory = activeRegistryType !== "trailers";
  registryCompanyField.hidden = !hasCompanyCategory;
  registryCategoryField.hidden = !hasCompanyCategory;
  registrySalaryField.hidden = !isDriver;
  registryDailyRateField.hidden = !isDriver;
  registryCommissionField.hidden = !isDriver;
  registryReferenceBadField.hidden = !isHorse;
  registryReferenceGoodField.hidden = !isHorse;
  registryReferenceExcellentField.hidden = !isHorse;
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
      const costs = activeRegistryType === "drivers"
        ? `Salário ${money(item.monthlySalary)} | Diária ${money(item.dailyRate)} | Comissão ${money(item.tripCommission)}`
        : "";
      const reference = activeRegistryType === "horses"
        ? [
            kmReference(item.ruim) && `Ruim ${kmReference(item.ruim)}`,
            kmReference(item.regular) && `Bom ${kmReference(item.regular)}`,
            kmReference(item.excelente) && `Excelente ${kmReference(item.excelente)}`,
          ].filter(Boolean).join(" | ")
        : "";
      const details = [item.company, item.category, costs, reference].filter(Boolean).join(" • ");
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

const tripWhatsAppIntro = `🚛 Encerramento de Viagem

Segue abaixo o resumo da viagem concluída, contendo os principais dados operacionais e indicadores de desempenho para acompanhamento da frota.`;

function numberText(value, suffix = "") {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || !number) return "-";
  return `${number.toLocaleString("pt-BR")}${suffix}`;
}

function tripDistanceText(record) {
  const start = Number(record.startKm || 0);
  const final = Number(record.finalKm || 0);
  if (!Number.isFinite(start) || !Number.isFinite(final) || !start || !final || final < start) return "-";
  return `${(final - start).toLocaleString("pt-BR")} km`;
}

function percentText(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${number.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
}

function kmText(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${number.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km`;
}

function kmhText(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${number.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km/h`;
}

function vehicleTelemetry(record) {
  return record?.torreVehicle || null;
}

function vehicleTripHistory(record) {
  return record?.torreTrip || null;
}

function plateKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isDieselS10Fuel(fuel) {
  return String(fuel?.fuelType || "DIESEL S10").toUpperCase().includes("DIESEL");
}

function performanceFuelEntries(record) {
  const horse = plateKey(record?.horsePlate);
  return (record?.fuels || []).filter((fuel) => {
    const supplied = plateKey(fuel.vehiclePlate || record.horsePlate);
    return isDieselS10Fuel(fuel) && (!horse || !supplied || supplied === horse);
  });
}

function driverTripKm(record) {
  const start = Number(record?.startKm || 0);
  const final = Number(record?.finalKm || 0);
  if (!Number.isFinite(start) || !Number.isFinite(final) || !start || !final || final < start) return null;
  return final - start;
}

function driverTripLiters(record) {
  const total = performanceFuelEntries(record).reduce((sum, fuel) => sum + Number(fuel.liters || 0), 0);
  return total > 0 ? total : null;
}

function driverTripAverage(record) {
  const km = driverTripKm(record);
  const liters = driverTripLiters(record);
  return km !== null && liters ? km / liters : null;
}

function numberDiffText(value, suffix = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`;
}

function decimalText(value, suffix = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${number.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
}

function tripHistoryText(record) {
  const history = vehicleTripHistory(record);
  if (!history) return "Comparativo da viagem: não coletado.";
  if (!history.available) return `Comparativo da viagem: ${history.reason || "sem histórico suficiente."}`;
  const driverKm = driverTripKm(record);
  const driverLiters = driverTripLiters(record);
  const driverAverage = driverTripAverage(record);
  return `Comparativo Motorista x Torre:
KM motorista: ${kmText(driverKm)}
KM Torre: ${kmText(history.km)}
Diferença KM: ${driverKm !== null && Number.isFinite(Number(history.km)) ? numberDiffText(Number(history.km) - driverKm, " km") : "-"}
Litros motorista: ${driverLiters ? numberText(driverLiters, " L") : "-"}
Litros Torre: ${history.liters ? numberText(history.liters, " L") : "-"}
Média motorista: ${driverAverage ? decimalText(driverAverage, " km/L") : "-"}
Média Torre: ${history.kmPerLiter ? decimalText(history.kmPerLiter, " km/L") : "-"}
Vmax na viagem: ${kmhText(history.vmaxKmh)}
Acima de 100 km/h: ${percentText(history.pctAbove100)}
Diesel final Torre: ${percentText(history.dieselEndPct)}
Arla final Torre: ${percentText(history.arlaEndPct)}`;
}

function vehicleTelemetryText(record) {
  const telemetry = vehicleTelemetry(record);
  if (!telemetry) return "Dados da Torre de Controle: não coletados.";
  return `Dados da Torre de Controle:
KM do veículo: ${kmText(telemetry.odometerKm)}
Diesel: ${percentText(telemetry.dieselPct)}
Arla: ${percentText(telemetry.arlaPct)}
Velocidade atual: ${kmhText(telemetry.speedKmh)}
Velocidade máxima 24h: ${kmhText(telemetry.vmax24Kmh)}
Acima de 100 km/h: ${percentText(telemetry.pctAbove100)}
Atualizado em: ${telemetry.updatedAt ? new Date(telemetry.updatedAt).toLocaleString("pt-BR") : "-"}`;
}

function fuelWhatsAppSummary(record) {
  const fuels = record.fuels || [];
  if (!fuels.length) return "-";
  return fuels
    .map((fuel, index) => {
      const parts = [
        `${index + 1}. ${fuel.fuelType || "DIESEL S10"}`,
        fuel.vehiclePlate || record.horsePlate || "",
        fuel.liters ? `${numberText(fuel.liters, " L")}` : "",
        fuel.value ? money(fuel.value) : "",
      ].filter(Boolean);
      return parts.join(" - ");
    })
    .join("\n");
}

function loadWhatsAppSummary(record) {
  const loads = normalizedLoadEntries(record);
  if (!loads.length) return "-";
  return loads
    .map((load, index) => {
      const parts = [
        `${index + 1}. Quantidade ${load.amount ? numberText(load.amount) : "-"}`,
        load.invoiceKey ? `NF ${load.invoiceKey}` : "",
      ].filter(Boolean);
      return parts.join(" - ");
    })
    .join("\n");
}

function buildTripWhatsAppMessage(record) {
  return `${tripWhatsAppIntro}

Resumo da viagem:
Motorista: ${record.driverName || "-"}
Empresa: ${record.companyName || "-"}
Cavalo: ${record.horsePlate || "-"}
Carreta: ${record.trailerPlate || "-"}
Período: ${record.tripDate || "-"} até ${record.tripEndDate || "-"}
KM inicial: ${numberText(record.startKm)}
KM final: ${numberText(record.finalKm)}
KM rodado: ${tripDistanceText(record)}
Frete: ${money(record.freightValue)}
Caixinha: ${money(record.vehicleCash)}
Despesas: ${money(record.travelExpenses)}

Carregamentos:
${loadWhatsAppSummary(record)}

Abastecimentos:
${fuelWhatsAppSummary(record)}

${vehicleTelemetryText(record)}

${tripHistoryText(record)}`;
}

function cleanPdfText(value) {
  return String(value || "-").replace(/\s+/g, " ").trim();
}

function formatTripDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  if (year && month && day) return `${day}/${month}/${year}`;
  return value;
}

function sumFuels(record, field) {
  return (record.fuels || []).reduce((total, fuel) => total + Number(fuel[field] || 0), 0);
}

function tripBalance(record) {
  const freight = Number(record.freightValue || 0);
  const expenses = Number(record.travelExpenses || 0);
  const cash = Number(record.vehicleCash || 0);
  const fuel = sumFuels(record, "value");
  return freight - expenses - cash - fuel;
}

function tripAverageKm(record) {
  const start = Number(record.startKm || 0);
  const final = Number(record.finalKm || 0);
  const liters = sumFuels(record, "liters");
  if (!start || !final || final < start || !liters) return "-";
  return `${((final - start) / liters).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/L`;
}

function detailRowsForPdf(record) {
  const rows = (record.fuels || []).map((fuel) => ({
    date: formatTripDate(fuel.date || record.tripEndDate || record.tripDate),
    description: cleanPdfText(`${fuel.fuelType || "DIESEL S10"} - ${fuel.vehiclePlate || record.horsePlate || "-"} - ${fuel.liters || "-"} lts`),
    type: "Despesa",
    value: `- ${money(fuel.value)}`,
    owner: "Empresa",
    notes: invoiceDisplay(fuel.invoiceKey),
  }));

  if (Number(record.freightValue || 0)) {
    rows.push({
      date: formatTripDate(record.tripEndDate || record.tripDate),
      description: "FRETE",
      type: "Receita",
      value: `+ ${money(record.freightValue)}`,
      owner: "Empresa",
      notes: "-",
    });
  }

  normalizedLoadEntries(record).forEach((load, index) => {
    rows.push({
      date: formatTripDate(record.tripEndDate || record.tripDate),
      description: cleanPdfText(`CARREGAMENTO ${index + 1} - ${load.amount || "-"} carregado`),
      type: "Carga",
      value: "-",
      owner: "Empresa",
      notes: invoiceDisplay(load.invoiceKey),
    });
  });

  if (Number(record.travelExpenses || 0)) {
    rows.push({
      date: formatTripDate(record.tripEndDate || record.tripDate),
      description: "DESPESAS DE VIAGEM",
      type: "Despesa",
      value: `- ${money(record.travelExpenses)}`,
      owner: "Motorista",
      notes: receiptHasFile(record.travelExpenseReceipt) ? "Comprovante anexado" : "-",
    });
  }

  return rows.length ? rows : [{
    date: formatTripDate(record.tripEndDate || record.tripDate),
    description: "VIAGEM FINALIZADA",
    type: "-",
    value: "-",
    owner: "-",
    notes: "-",
  }];
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = cleanPdfText(text).split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function drawPdfText(ctx, text, x, y, maxWidth, lineHeight = 13) {
  const lines = wrapCanvasText(ctx, text, maxWidth);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return lines.length * lineHeight;
}

const PDF_PAGE_WIDTH = 841.89;
const PDF_PAGE_HEIGHT = 595.28;
const PDF_MARGIN = 32;
const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN * 2;

function newPdfCanvasPage() {
  const scale = 2;
  const width = PDF_PAGE_WIDTH;
  const height = PDF_PAGE_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.pdfWidth = width;
  canvas.pdfHeight = height;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx, width, height };
}

function drawPdfHeader(page, logoImage) {
  const { ctx, width } = page;
  if (logoImage) {
    ctx.drawImage(logoImage, PDF_MARGIN, 18, 150, 80);
  } else {
    ctx.fillStyle = "#004b8d";
    ctx.fillRect(PDF_MARGIN, 18, 150, 80);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px Arial";
    ctx.fillText("TAZ", PDF_MARGIN + 50, 62);
  }
  ctx.fillStyle = "#111111";
  ctx.font = "30px Arial";
  ctx.fillText("EXTRATO DE VIAGEM", 210, 58);
  ctx.font = "10px Arial";
  ctx.textAlign = "right";
  ctx.fillText(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, width - PDF_MARGIN, 58);
  ctx.textAlign = "left";
  ctx.strokeStyle = "#dddddd";
  ctx.beginPath();
  ctx.moveTo(0, 104);
  ctx.lineTo(width, 104);
  ctx.stroke();
}

function drawPdfSummary(page, record) {
  const { ctx } = page;
  const telemetry = vehicleTelemetry(record);
  const x = PDF_MARGIN;
  const y = 118;
  const width = PDF_CONTENT_WIDTH;
  const height = 188;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#d5dbe3";
  drawRoundRect(ctx, x, y, width, height, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f6f6f6";
  drawRoundRect(ctx, x, y, width, 24, 10);
  ctx.fill();
  ctx.fillStyle = "#6b7280";
  ctx.font = "bold 14px Arial";
  ctx.fillText("Resumo", x + 14, y + 18);

  const columns = [
    {
      title: "Viagem",
      rows: [
        `Viagem: ${String(record.id || "-").slice(0, 8)}`,
        `Tração: ${record.horsePlate || "-"}`,
        `Implemento: ${record.trailerPlate || "-"}`,
        `Empresa: ${record.companyName || "-"}`,
        `Motorista: ${record.driverName || "-"}`,
        `Período: ${formatTripDate(record.tripDate)} a ${formatTripDate(record.tripEndDate)}`,
      ],
    },
    {
      title: "Quilometragem",
      rows: [
        `Data de início: ${formatTripDate(record.tripDate)}`,
        `Data de término: ${formatTripDate(record.tripEndDate)}`,
        `Duração (dias): ${record.dailyCount || tripDays(record.tripDate, record.tripEndDate) || "-"}`,
        `KM Inicial: ${numberText(record.startKm)}`,
        `KM Final: ${numberText(record.finalKm)}`,
        `Distância: ${tripDistanceText(record)}`,
      ],
    },
    {
      title: "Financeiro / Carga",
      rows: [
        `Consumo médio: ${tripAverageKm(record)}`,
        `Combustível (L): ${numberText(sumFuels(record, "liters"))}`,
        `Frete: ${money(record.freightValue)}`,
        `Despesas: ${money(record.travelExpenses)}`,
        `Carga total: ${loadTotal(record) ? numberText(loadTotal(record)) : "-"}`,
        `NF carga: ${loadInvoiceNumberSummary(record) || "-"}`,
        `Saldo: ${money(tripBalance(record))}`,
      ],
    },
    {
      title: "Torre de Controle",
      rows: [
        `Torre KM: ${kmText(telemetry?.odometerKm)}`,
        `Torre Diesel: ${percentText(telemetry?.dieselPct)}`,
        `Torre Arla: ${percentText(telemetry?.arlaPct)}`,
        `Velocidade atual: ${kmhText(telemetry?.speedKmh)}`,
        `Vmax 24h: ${kmhText(telemetry?.vmax24Kmh)}`,
      ],
    },
  ];

  const columnWidth = (width - 28) / columns.length;
  columns.forEach((column, index) => {
    const colX = x + 14 + index * columnWidth;
    ctx.fillStyle = "#004b8d";
    ctx.font = "bold 10px Arial";
    ctx.fillText(column.title, colX, y + 48);
    ctx.fillStyle = "#505050";
    ctx.font = "9.5px Arial";
    column.rows.forEach((item, rowIndex) => {
      drawPdfText(ctx, item, colX, y + 66 + rowIndex * 16, columnWidth - 12, 10.5);
    });
  });
  return y + height + 16;
}

function comparisonValueText(value, formatter) {
  return value === null || value === undefined || value === "" ? "-" : formatter(value);
}

function hasMetric(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function pdfComparisonRows(record) {
  const history = vehicleTripHistory(record);
  const driverKm = driverTripKm(record);
  const driverLiters = driverTripLiters(record);
  const driverAverage = driverTripAverage(record);
  if (!history?.available) {
    return {
      available: false,
      reason: history?.reason || "Historico da Torre nao coletado para esta viagem.",
      rows: [],
    };
  }
  return {
    available: true,
    rows: [
      [
        "KM da viagem",
        comparisonValueText(driverKm, kmText),
        comparisonValueText(history.km, kmText),
        driverKm !== null && hasMetric(history.km)
          ? numberDiffText(Number(history.km) - driverKm, " km")
          : "-",
      ],
      [
        "Litros Diesel S10",
        comparisonValueText(driverLiters, (value) => decimalText(value, " L")),
        comparisonValueText(history.liters, (value) => decimalText(value, " L")),
        driverLiters !== null && hasMetric(history.liters)
          ? numberDiffText(Number(history.liters) - driverLiters, " L")
          : "-",
      ],
      [
        "Media KM/L",
        comparisonValueText(driverAverage, (value) => decimalText(value, " km/L")),
        comparisonValueText(history.kmPerLiter, (value) => decimalText(value, " km/L")),
        driverAverage !== null && hasMetric(history.kmPerLiter)
          ? numberDiffText(Number(history.kmPerLiter) - driverAverage, " km/L")
          : "-",
      ],
      ["Velocidade maxima", "-", kmhText(history.vmaxKmh), "-"],
      ["Acima de 100 km/h", "-", percentText(history.pctAbove100), "-"],
      ["Diesel / Arla finais", "-", `${percentText(history.dieselEndPct)} / ${percentText(history.arlaEndPct)}`, "-"],
    ],
  };
}

function drawPdfTorreComparison(page, record, y) {
  const { ctx } = page;
  const x = PDF_MARGIN;
  const width = PDF_CONTENT_WIDTH;
  const comparison = pdfComparisonRows(record);
  const rowHeight = 16;
  const height = comparison.available ? 42 + comparison.rows.length * rowHeight : 92;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#d5dbe3";
  drawRoundRect(ctx, x, y, width, height, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#eef6ff";
  drawRoundRect(ctx, x, y, width, 24, 10);
  ctx.fill();
  ctx.fillStyle = "#004b8d";
  ctx.font = "bold 13px Arial";
  ctx.fillText("Comparativo Motorista x Torre", x + 14, y + 17);

  if (!comparison.available) {
    ctx.fillStyle = "#555555";
    ctx.font = "10px Arial";
    drawPdfText(ctx, comparison.reason, x + 14, y + 48, width - 28, 12);
    return y + height + 20;
  }

  const columns = [
    [x + 14, 220, "Indicador"],
    [x + 250, 170, "Motorista"],
    [x + 420, 170, "Torre"],
    [x + 590, 170, "Diferença"],
  ];
  ctx.fillStyle = "#333333";
  ctx.font = "bold 9px Arial";
  columns.forEach(([colX, , label]) => ctx.fillText(label, colX, y + 40));
  ctx.font = "9px Arial";
  comparison.rows.forEach((row, rowIndex) => {
    const rowY = y + 58 + rowIndex * rowHeight;
    row.forEach((value, colIndex) => {
      const [colX, colWidth] = columns[colIndex];
      drawPdfText(ctx, value, colX, rowY, colWidth - 6, 10);
    });
  });
  return y + height + 20;
}

function drawPdfTableHeader(ctx, y) {
  const columns = [
    [PDF_MARGIN, 62, "Data"],
    [PDF_MARGIN + 62, 270, "Descrição"],
    [PDF_MARGIN + 332, 72, "Tipo"],
    [PDF_MARGIN + 404, 105, "Valor"],
    [PDF_MARGIN + 509, 98, "Responsável"],
    [PDF_MARGIN + 607, 171, "Observações"],
  ];
  ctx.fillStyle = "#f4f4f4";
  ctx.fillRect(PDF_MARGIN, y, PDF_CONTENT_WIDTH, 22);
  ctx.strokeStyle = "#cccccc";
  ctx.strokeRect(PDF_MARGIN, y, PDF_CONTENT_WIDTH, 22);
  ctx.fillStyle = "#111111";
  ctx.font = "bold 9px Arial";
  columns.forEach(([x, width, label]) => {
    ctx.strokeRect(x, y, width, 22);
    ctx.fillText(label, x + 5, y + 14);
  });
}

function drawPdfTableRow(ctx, row, y, height) {
  const columns = [
    [PDF_MARGIN, 62, row.date],
    [PDF_MARGIN + 62, 270, row.description],
    [PDF_MARGIN + 332, 72, row.type],
    [PDF_MARGIN + 404, 105, row.value],
    [PDF_MARGIN + 509, 98, row.owner],
    [PDF_MARGIN + 607, 171, row.notes],
  ];
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(PDF_MARGIN, y, PDF_CONTENT_WIDTH, height);
  ctx.strokeStyle = "#d0d0d0";
  ctx.fillStyle = "#555555";
  ctx.font = "9px Arial";
  columns.forEach(([x, width, value], index) => {
    ctx.strokeRect(x, y, width, height);
    const textX = index === 3 ? x + width - 5 : x + 5;
    if (index === 3) ctx.textAlign = "right";
    drawPdfText(ctx, value, textX, y + 14, width - 10, 11);
    ctx.textAlign = "left";
  });
}

function drawPdfFooter(page, pageNumber, totalPages) {
  const { ctx, width, height } = page;
  ctx.fillStyle = "#8a8a8a";
  ctx.font = "10px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`Página ${pageNumber} de ${totalPages}`, width / 2, height - 34);
  ctx.fillText("TAZ Transportadora - Controle de Viagens", width / 2, height - 18);
  ctx.textAlign = "left";
}

async function renderTripPdfPages(record) {
  let logoImage = null;
  try {
    logoImage = await loadImage("taz-logo-relatorio.jpg");
  } catch (error) {
    logoImage = null;
  }
  const pages = [];
  let page = newPdfCanvasPage();
  pages.push(page);
  drawPdfHeader(page, logoImage);
  let y = drawPdfSummary(page, record);
  drawPdfTableHeader(page.ctx, y);
  y += 22;

  detailRowsForPdf(record).forEach((row) => {
    page.ctx.font = "9px Arial";
    const descriptionLines = wrapCanvasText(page.ctx, row.description, 258).length;
    const notesLines = wrapCanvasText(page.ctx, row.notes, 159).length;
    const rowHeight = Math.max(34, 16 + Math.max(descriptionLines, notesLines) * 11);
    if (y + rowHeight > page.height - 60) {
      page = newPdfCanvasPage();
      pages.push(page);
      drawPdfHeader(page, logoImage);
      y = 118;
      drawPdfTableHeader(page.ctx, y);
      y += 22;
    }
    drawPdfTableRow(page.ctx, row, y, rowHeight);
    y += rowHeight;
  });

  y += 16;
  const comparisonHeight = pdfComparisonRows(record).available ? 42 + pdfComparisonRows(record).rows.length * 16 : 92;
  if (y + comparisonHeight > page.height - 60) {
    page = newPdfCanvasPage();
    pages.push(page);
    drawPdfHeader(page, logoImage);
    y = 118;
  }
  drawPdfTorreComparison(page, record, y);

  pages.forEach((item, index) => drawPdfFooter(item, index + 1, pages.length));
  return pages.map((item) => item.canvas);
}

function base64ToBytes(base64) {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function asciiBytes(text) {
  return new TextEncoder().encode(text);
}

function pdfObject(id, body) {
  return concatBytes([
    asciiBytes(`${id} 0 obj\n`),
    body instanceof Uint8Array ? body : asciiBytes(body),
    asciiBytes("\nendobj\n"),
  ]);
}

function buildImagePdf(jpegPages) {
  const pageWidth = jpegPages[0]?.pdfWidth || PDF_PAGE_WIDTH;
  const pageHeight = jpegPages[0]?.pdfHeight || PDF_PAGE_HEIGHT;
  const objects = [];
  const kids = [];
  let nextId = 3;

  jpegPages.forEach((page, index) => {
    const pageId = nextId;
    const contentId = nextId + 1;
    const imageId = nextId + 2;
    const imageName = `Im${index + 1}`;
    nextId += 3;
    kids.push(`${pageId} 0 R`);
    objects.push(pdfObject(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));
    const command = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/${imageName} Do\nQ`;
    objects.push(pdfObject(contentId, `<< /Length ${command.length} >>\nstream\n${command}\nendstream`));
    objects.push(pdfObject(imageId, concatBytes([
      asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`),
      page.bytes,
      asciiBytes("\nendstream"),
    ])));
  });

  const header = asciiBytes("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const allObjects = [
    pdfObject(1, "<< /Type /Catalog /Pages 2 0 R >>"),
    pdfObject(2, `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>`),
    ...objects,
  ];

  const offsets = [0];
  let position = header.length;
  allObjects.forEach((object) => {
    offsets.push(position);
    position += object.length;
  });
  const xrefStart = position;
  const xref = [
    `xref\n0 ${allObjects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${allObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`,
  ].join("");

  return new Blob([concatBytes([header, ...allObjects, asciiBytes(xref)])], { type: "application/pdf" });
}

async function createTripSummaryPdfFile(record) {
  const canvases = await renderTripPdfPages(record);
  const jpegPages = canvases.map((canvas) => {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    return {
      width: canvas.width,
      height: canvas.height,
      pdfWidth: canvas.pdfWidth || PDF_PAGE_WIDTH,
      pdfHeight: canvas.pdfHeight || PDF_PAGE_HEIGHT,
      bytes: base64ToBytes(dataUrl.split(",")[1]),
    };
  });
  const blob = buildImagePdf(jpegPages);
  const safeId = String(record.id || "viagem").slice(0, 8);
  return new File([blob], `resumo_viagem_${safeId}.pdf`, { type: "application/pdf" });
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

async function shareTripOnWhatsApp(record) {
  const message = tripWhatsAppIntro;
  const fallbackMessage = buildTripWhatsAppMessage(record);
  const file = await createTripSummaryPdfFile(record);
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      title: "Encerramento de Viagem",
      text: message,
      files: [file],
    });
    return;
  }

  downloadFile(file);
  window.open(`https://wa.me/?text=${encodeURIComponent(fallbackMessage)}`, "_blank", "noopener,noreferrer");
}

function kmReference(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "";
  return number.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function saveRecords() {
  localStorage.setItem(storageKey, JSON.stringify(records));
}

function saveMaintenanceRecords() {
  localStorage.setItem(maintenanceStorageKey, JSON.stringify(maintenanceRecords));
}

function syncLabel(status, recordStatus = "") {
  if (recordStatus === "canceled") return ["Cancelada", "canceled"];
  if (status === "draft") return ["Rascunho", "draft"];
  if (status === "synced") return ["Salvo na base online", "synced"];
  if (status === "failed") return ["Falha no envio", "failed"];
  return ["Aguardando envio", "pending"];
}

function tripTorrePeriod(record) {
  if (!record?.tripDate) return {};
  const startDate = record.tripDate;
  const endDate = record.tripEndDate || record.tripDate;
  return {
    startAt: `${startDate}T00:00:00-03:00`,
    endAt: `${endDate}T23:59:59-03:00`,
  };
}

async function fetchVehicleTelemetry(record) {
  if (!record?.horsePlate || !navigator.onLine || !location.protocol.startsWith("http")) return null;
  const response = await fetch("/api/torre-veiculo", {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ plate: record.horsePlate, ...tripTorrePeriod(record) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || "Consulta da Torre recusada.");
  return result || null;
}

async function enrichRecordWithVehicleTelemetry(record) {
  try {
    const telemetryResult = await fetchVehicleTelemetry(record);
    if (telemetryResult?.vehicle) {
      record.torreVehicle = telemetryResult.vehicle;
      record.torreVehicleCapturedAt = new Date().toISOString();
      record.torreVehicleError = "";
    }
    if (telemetryResult?.tripHistory) {
      record.torreTrip = telemetryResult.tripHistory;
      record.torreTripCapturedAt = new Date().toISOString();
      record.torreTripError = telemetryResult.tripHistory.available ? "" : telemetryResult.tripHistory.reason || "";
    }
  } catch (error) {
    record.torreVehicleError = error.message || "Falha ao consultar a Torre de Controle.";
    record.torreTripError = error.message || "Falha ao consultar o histórico da Torre.";
  }
  return record;
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

function maintenanceForSync(record) {
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
    records[index].syncStatus === "draft" ||
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

async function syncMaintenanceRecord(recordId) {
  const index = maintenanceRecords.findIndex((record) => record.id === recordId);
  if (
    index < 0 ||
    (maintenanceRecords[index].syncStatus === "synced" && maintenanceRecords[index].centralSyncVersion === 1)
  ) {
    return true;
  }

  if (!navigator.onLine || !location.protocol.startsWith("http")) {
    maintenanceRecords[index].syncStatus = "pending";
    saveMaintenanceRecords();
    renderMaintenanceRecords();
    return false;
  }

  maintenanceRecords[index].syncStatus = "pending";
  maintenanceRecords[index].syncError = "";
  saveMaintenanceRecords();
  renderMaintenanceRecords();

  try {
    const response = await fetch("/api/sync-maintenance", {
      method: "POST",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ record: maintenanceForSync(maintenanceRecords[index]) }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "O servidor não confirmou o envio.");
    }

    maintenanceRecords[index].syncStatus = "synced";
    maintenanceRecords[index].centralSyncVersion = 1;
    maintenanceRecords[index].syncedAt = new Date().toISOString();
    maintenanceRecords[index].syncError = "";
    saveMaintenanceRecords();
    renderMaintenanceRecords();
    return true;
  } catch (error) {
    maintenanceRecords[index].syncStatus = "failed";
    maintenanceRecords[index].syncError = error.message;
    saveMaintenanceRecords();
    renderMaintenanceRecords();
    return false;
  }
}

async function syncPendingRecords() {
  const pending = records.filter(
    (record) =>
      record.syncStatus !== "draft" &&
      (record.syncStatus !== "synced" || record.centralSyncVersion !== 1)
  );
  const pendingMaintenance = maintenanceRecords.filter(
    (record) => record.syncStatus !== "synced" || record.centralSyncVersion !== 1
  );
  if (!pending.length && !pendingMaintenance.length) {
    syncStatus.textContent = "Todos os registros deste aparelho ja foram enviados.";
    if (maintenanceStatus) maintenanceStatus.textContent = "Todas as manutencoes deste aparelho ja foram enviadas.";
    return;
  }

  syncPendingButton.disabled = true;
  syncStatus.textContent = `Enviando ${pending.length} viagem(ns) e ${pendingMaintenance.length} manutencao(oes) para a base online...`;
  let sent = 0;
  let maintenanceSent = 0;

  for (const record of pending) {
    if (await syncRecord(record.id)) sent += 1;
  }
  for (const record of pendingMaintenance) {
    if (await syncMaintenanceRecord(record.id)) maintenanceSent += 1;
  }

  const remaining = records.filter(
    (record) =>
      record.syncStatus !== "draft" &&
      (record.syncStatus !== "synced" || record.centralSyncVersion !== 1)
  ).length;
  const remainingMaintenance = maintenanceRecords.filter(
    (record) => record.syncStatus !== "synced" || record.centralSyncVersion !== 1
  ).length;
  syncStatus.textContent = remaining || remainingMaintenance
    ? `${sent} viagem(ns) e ${maintenanceSent} manutencao(oes) enviadas. Pendentes: ${remaining + remainingMaintenance}.`
    : `${sent} viagem(ns) e ${maintenanceSent} manutencao(oes) enviadas. Base sincronizada.`;
  syncPendingButton.disabled = false;
}

function createFuelEntry(fuel = {}) {
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
      Data do abastecimento
      <input class="fuel-date-input" name="fuelDate[]" type="date" />
    </label>
    <label>
      Tipo de combustível
      <select class="fuel-type-input" name="fuelType[]">
        <option value="DIESEL S10">Diesel S10</option>
        <option value="ARLA 32">Arla 32</option>
      </select>
    </label>
    <label>
      Placa do veículo abastecido
      <input class="fuel-plate-input" name="fuelPlate[]" type="text" list="fuelVehicleOptions" placeholder="Selecione ou digite a placa" autocapitalize="characters" />
    </label>
    <label>
      KM do abastecimento
      <input class="fuel-km-input" name="fuelKm[]" type="number" min="0" inputmode="numeric" placeholder="Ex.: 125420" />
    </label>
    <label>
      Litros abastecidos
      <input class="fuel-liters-input" name="fuelLiters[]" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Ex.: 450,00" />
    </label>
    <label>
      Valor total
      <input class="fuel-value-input" name="fuelValue[]" type="number" min="0" step="0.01" inputmode="decimal" placeholder="R$ 0,00" />
    </label>
    <label>
      Chave de acesso da NF
      <div class="scan-row">
        <input id="${invoiceId}" class="fuel-invoice-input" name="fuelInvoiceKey[]" type="text" inputmode="numeric" maxlength="44" placeholder="44 dígitos" />
        <button class="icon-button" type="button" data-scan-target="${invoiceId}" aria-label="Ler chave de abastecimento pela câmera">📷</button>
      </div>
    </label>
    <div class="nfe-actions">
      <button class="secondary compact-button nfe-fetch-button" type="button" data-nfe-fetch="fuel">Buscar dados da NF</button>
      <button class="secondary compact-button nfe-import-button" type="button" data-nfe-import="fuel">Importar XML</button>
      <input class="nfe-xml-input" type="file" accept=".xml,text/xml,application/xml" hidden />
    </div>
    <div class="nfe-summary" data-nfe-summary></div>
  `;
  fuelEntries.appendChild(entry);
  entry.querySelector(".fuel-date-input").value = fuel.date || "";
  entry.querySelector(".fuel-type-input").value = fuel.fuelType || "DIESEL S10";
  entry.querySelector(".fuel-plate-input").value = fuel.vehiclePlate || "";
  entry.querySelector(".fuel-km-input").value = fuel.km || "";
  entry.querySelector(".fuel-liters-input").value = fuel.liters || "";
  entry.querySelector(".fuel-value-input").value = fuel.value || "";
  entry.querySelector(".fuel-invoice-input").value = fuel.invoiceKey || "";
  setEntryNfe(entry, fuel.nfe || null);
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
      date: entry.querySelector(".fuel-date-input").value,
      fuelType: entry.querySelector(".fuel-type-input").value,
      vehiclePlate: String(entry.querySelector(".fuel-plate-input").value || "").toUpperCase(),
      km: entry.querySelector(".fuel-km-input").value,
      liters: entry.querySelector(".fuel-liters-input").value,
      value: entry.querySelector(".fuel-value-input").value,
      invoiceKey: entry.querySelector(".fuel-invoice-input").value,
      nfe: entryNfe(entry),
    }))
    .filter((entry) => entry.date || entry.vehiclePlate || entry.km || entry.liters || entry.value || entry.invoiceKey);
}

function resetFuelEntries(fuels = []) {
  fuelEntries.innerHTML = "";
  fuelEntryCount = 0;
  if (fuels.length) fuels.forEach(createFuelEntry);
  else createFuelEntry();
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
  return normalizedLoadEntries(record).reduce((total, load) => total + Number(load.amount || 0), 0);
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

function invoiceDisplay(value) {
  const number = invoiceNumberFromKey(value);
  return number ? `NF ${number}` : "-";
}

function loadInvoiceNumberSummary(record = {}) {
  const numbers = normalizedLoadEntries(record)
    .map((load) => invoiceNumberFromKey(load.invoiceKey))
    .filter(Boolean);
  return numbers.length ? numbers.join(" | ") : "";
}

function loadSummaryText(record = {}) {
  const loads = normalizedLoadEntries(record);
  if (!loads.length) return "-";
  return loads
    .map((load, index) => {
      const amount = load.amount ? numberText(load.amount) : "-";
      const invoice = load.invoiceKey ? invoiceDisplay(load.invoiceKey) : "NF -";
      return `${index + 1}. ${amount} - ${invoice}`;
    })
    .join(" | ");
}

function xmlNodeText(parent, tag) {
  const node = parent?.getElementsByTagName(tag)?.[0];
  return node ? node.textContent.trim() : "";
}

function dateInputFromNfe(value) {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function numberInputFromNfe(value) {
  const number = Number(String(value || "").replace(",", "."));
  return Number.isFinite(number) && number > 0 ? String(number) : "";
}

function normalizeNfeProductName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function parseNfeXmlString(xmlText, fallbackKey = "") {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML da NF-e invalido.");
  const infNFe = doc.getElementsByTagName("infNFe")[0];
  const ide = doc.getElementsByTagName("ide")[0];
  const emit = doc.getElementsByTagName("emit")[0];
  const dest = doc.getElementsByTagName("dest")[0];
  const total = doc.getElementsByTagName("ICMSTot")[0];
  const transporta = doc.getElementsByTagName("transporta")[0];
  const veicTransp = doc.getElementsByTagName("veicTransp")[0];
  const vol = doc.getElementsByTagName("vol")[0];
  const enderEmit = emit?.getElementsByTagName("enderEmit")?.[0];
  const enderDest = dest?.getElementsByTagName("enderDest")?.[0];
  const products = Array.from(doc.getElementsByTagName("det")).map((det) => {
    const prod = det.getElementsByTagName("prod")[0];
    if (!prod) return null;
    return {
      code: xmlNodeText(prod, "cProd"),
      description: xmlNodeText(prod, "xProd"),
      ncm: xmlNodeText(prod, "NCM"),
      quantity: xmlNodeText(prod, "qCom"),
      unit: xmlNodeText(prod, "uCom"),
      value: xmlNodeText(prod, "vProd"),
    };
  }).filter(Boolean);
  const chave = infNFe?.getAttribute("Id")?.replace(/^NFe/i, "") || onlyDigits(fallbackKey);
  return {
    source: "NFE_XML",
    capturedAt: new Date().toISOString(),
    chave,
    numero: xmlNodeText(ide, "nNF") || invoiceNumberFromKey(chave),
    serie: xmlNodeText(ide, "serie"),
    emissao: xmlNodeText(ide, "dhEmi") || xmlNodeText(ide, "dEmi"),
    valorTotal: xmlNodeText(total, "vNF"),
    emitente: xmlNodeText(emit, "xNome"),
    cnpjEmitente: xmlNodeText(emit, "CNPJ"),
    destinatario: xmlNodeText(dest, "xNome"),
    docDestinatario: xmlNodeText(dest, "CNPJ") || xmlNodeText(dest, "CPF"),
    origem: [xmlNodeText(enderEmit, "xMun"), xmlNodeText(enderEmit, "UF")].filter(Boolean).join(" / "),
    destino: [xmlNodeText(enderDest, "xMun"), xmlNodeText(enderDest, "UF")].filter(Boolean).join(" / "),
    transportadora: xmlNodeText(transporta, "xNome"),
    placa: xmlNodeText(veicTransp, "placa"),
    pesoBruto: xmlNodeText(vol, "pesoB"),
    pesoLiquido: xmlNodeText(vol, "pesoL"),
    volumes: xmlNodeText(vol, "qVol"),
    products: products.slice(0, 20),
  };
}

function fuelInfoFromNfe(nfe) {
  const product = (nfe.products || []).find((item) => {
    const name = normalizeNfeProductName(item.description);
    return name.includes("DIESEL") || name.includes("ARLA");
  });
  if (!product) return {};
  const name = normalizeNfeProductName(product.description);
  return {
    fuelType: name.includes("ARLA") ? "ARLA 32" : "DIESEL S10",
    liters: numberInputFromNfe(product.quantity),
    productName: product.description,
  };
}

function loadAmountFromNfe(nfe) {
  const productsTotal = (nfe.products || []).reduce((total, product) => {
    const value = Number(String(product.quantity || "").replace(",", "."));
    return Number.isFinite(value) ? total + value : total;
  }, 0);
  return numberInputFromNfe(nfe.pesoLiquido) ||
    numberInputFromNfe(nfe.pesoBruto) ||
    (productsTotal > 0 ? String(productsTotal) : "") ||
    numberInputFromNfe(nfe.volumes);
}

function compactNfe(nfe = {}) {
  return {
    source: nfe.source || "NFE_XML",
    capturedAt: nfe.capturedAt || new Date().toISOString(),
    chave: onlyDigits(nfe.chave),
    numero: nfe.numero || invoiceNumberFromKey(nfe.chave),
    serie: nfe.serie || "",
    emissao: nfe.emissao || "",
    valorTotal: nfe.valorTotal || "",
    emitente: nfe.emitente || "",
    cnpjEmitente: nfe.cnpjEmitente || "",
    destinatario: nfe.destinatario || "",
    docDestinatario: nfe.docDestinatario || "",
    origem: nfe.origem || "",
    destino: nfe.destino || "",
    transportadora: nfe.transportadora || "",
    placa: nfe.placa || "",
    pesoBruto: nfe.pesoBruto || "",
    pesoLiquido: nfe.pesoLiquido || "",
    volumes: nfe.volumes || "",
    products: (nfe.products || []).slice(0, 20),
  };
}

function nfeSummaryText(nfe = {}) {
  if (!nfe || !Object.keys(nfe).length) return "";
  const product = nfe.products?.[0]?.description || "";
  return [
    nfe.numero ? `NF ${nfe.numero}` : invoiceDisplay(nfe.chave),
    dateInputFromNfe(nfe.emissao) ? formatTripDate(dateInputFromNfe(nfe.emissao)) : "",
    nfe.valorTotal ? money(nfe.valorTotal) : "",
    nfe.emitente,
    nfe.origem && nfe.destino ? `${nfe.origem} -> ${nfe.destino}` : "",
    product,
  ].filter(Boolean).join(" | ");
}

function setEntryNfe(entry, nfe) {
  const summary = entry.querySelector("[data-nfe-summary]");
  const compact = nfe ? compactNfe(nfe) : null;
  if (compact) {
    entry.dataset.nfe = JSON.stringify(compact);
    if (summary) {
      summary.hidden = false;
      summary.textContent = nfeSummaryText(compact);
    }
  } else {
    delete entry.dataset.nfe;
    if (summary) {
      summary.hidden = true;
      summary.textContent = "";
    }
  }
}

function entryNfe(entry) {
  try {
    return entry.dataset.nfe ? JSON.parse(entry.dataset.nfe) : null;
  } catch (_error) {
    return null;
  }
}

function applyNfeToFuelEntry(entry, nfe) {
  const info = fuelInfoFromNfe(nfe);
  const date = dateInputFromNfe(nfe.emissao);
  const key = onlyDigits(nfe.chave);
  if (date && !entry.querySelector(".fuel-date-input").value) entry.querySelector(".fuel-date-input").value = date;
  if (info.fuelType) entry.querySelector(".fuel-type-input").value = info.fuelType;
  if (nfe.placa && !entry.querySelector(".fuel-plate-input").value) entry.querySelector(".fuel-plate-input").value = String(nfe.placa).toUpperCase();
  if (info.liters && !entry.querySelector(".fuel-liters-input").value) entry.querySelector(".fuel-liters-input").value = info.liters;
  if (nfe.valorTotal && !entry.querySelector(".fuel-value-input").value) entry.querySelector(".fuel-value-input").value = numberInputFromNfe(nfe.valorTotal);
  if (key) entry.querySelector(".fuel-invoice-input").value = key;
  setEntryNfe(entry, nfe);
}

function applyNfeToLoadEntry(entry, nfe) {
  const key = onlyDigits(nfe.chave);
  const amount = loadAmountFromNfe(nfe);
  if (amount && !entry.querySelector(".load-amount-input").value) entry.querySelector(".load-amount-input").value = amount;
  if (key) entry.querySelector(".load-invoice-input").value = key;
  setEntryNfe(entry, nfe);
}

function applyNfeToEntry(entry, nfe) {
  if (entry.classList.contains("load-entry")) applyNfeToLoadEntry(entry, nfe);
  else applyNfeToFuelEntry(entry, nfe);
}

async function fetchNfeByKey(chave) {
  const response = await fetch("/api/nfe", {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ chave }),
  });
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (_error) {
    data = { error: raw || response.statusText };
  }
  if (!response.ok || !data.ok) {
    throw new Error(data.error || response.statusText || "Nao foi possivel consultar a NF-e.");
  }
  return parseNfeXmlString(data.xml || "", chave);
}

async function fetchNfeForEntry(button) {
  const entry = button.closest(".fuel-entry");
  const input = entry?.querySelector(".fuel-invoice-input, .load-invoice-input");
  const key = onlyDigits(input?.value);
  if (!entry || key.length !== 44) {
    showToast(`Chave da NF-e incompleta: ${key.length}/44 digitos.`);
    return;
  }
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Buscando...";
  try {
    const nfe = await fetchNfeByKey(key);
    applyNfeToEntry(entry, nfe);
    showToast("Dados da NF-e preenchidos.");
  } catch (error) {
    showToast(error.message || "Nao foi possivel buscar a NF-e.");
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function importNfeXmlForEntry(input) {
  const entry = input.closest(".fuel-entry");
  const file = input.files && input.files[0];
  if (!entry || !file) return;
  try {
    const nfe = parseNfeXmlString(await file.text());
    applyNfeToEntry(entry, nfe);
    showToast("XML da NF-e importado.");
  } catch (error) {
    showToast(error.message || "Nao foi possivel ler o XML.");
  } finally {
    input.value = "";
  }
}

function createLoadEntry(load = {}) {
  loadEntryCount += 1;
  const entry = document.createElement("div");
  const invoiceId = `loadInvoiceKey${loadEntryCount}`;
  entry.className = "fuel-entry load-entry";
  entry.innerHTML = `
    <div class="fuel-entry-head">
      <strong>Carregamento ${loadEntryCount}</strong>
      <button class="secondary remove-load-button" type="button">Remover</button>
    </div>
    <label>
      Quantidade carregada
      <input class="load-amount-input" name="loadAmount[]" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Ex.: 32,50" />
    </label>
    <label>
      Chave de acesso da NF
      <div class="scan-row">
        <input id="${invoiceId}" class="load-invoice-input" name="loadInvoiceKey[]" type="text" inputmode="numeric" maxlength="44" placeholder="44 digitos" />
        <button class="icon-button" type="button" data-scan-target="${invoiceId}" aria-label="Ler chave de carregamento pela camera">📷</button>
      </div>
    </label>
    <div class="nfe-actions">
      <button class="secondary compact-button nfe-fetch-button" type="button" data-nfe-fetch="load">Buscar dados da NF</button>
      <button class="secondary compact-button nfe-import-button" type="button" data-nfe-import="load">Importar XML</button>
      <input class="nfe-xml-input" type="file" accept=".xml,text/xml,application/xml" hidden />
    </div>
    <div class="nfe-summary" data-nfe-summary></div>
  `;
  loadEntries.appendChild(entry);
  entry.querySelector(".load-amount-input").value = load.amount || "";
  entry.querySelector(".load-invoice-input").value = load.invoiceKey || "";
  setEntryNfe(entry, load.nfe || null);
  updateLoadRemoveButtons();
}

function updateLoadRemoveButtons() {
  const entries = loadEntries.querySelectorAll(".load-entry");
  entries.forEach((entry) => {
    const removeButton = entry.querySelector(".remove-load-button");
    removeButton.hidden = entries.length === 1;
  });
}

function collectLoadEntries() {
  return Array.from(loadEntries.querySelectorAll(".load-entry"))
    .map((entry, index) => ({
      number: index + 1,
      amount: entry.querySelector(".load-amount-input").value,
      invoiceKey: entry.querySelector(".load-invoice-input").value,
      nfe: entryNfe(entry),
    }))
    .filter((entry) => entry.amount || entry.invoiceKey);
}

function resetLoadEntries(loads = []) {
  loadEntries.innerHTML = "";
  loadEntryCount = 0;
  if (loads.length) loads.forEach(createLoadEntry);
  else createLoadEntry();
}

function setDefaultTripDate() {
  const field = document.querySelector("#tripDate");
  if (field && !field.value) field.value = new Date().toISOString().slice(0, 10);
}

function setDefaultMaintenanceDate() {
  if (maintenanceDate && !maintenanceDate.value) maintenanceDate.value = new Date().toISOString().slice(0, 10);
}

function receiptHasFile(receipt) {
  return Boolean(receipt?.dataUrl || receipt?.attachmentKey || receipt?.hasFile);
}

function resetTravelExpenseReceipt(receipt = null) {
  travelExpenseReceipt = receipt && receiptHasFile(receipt) ? { ...receipt } : null;
  if (travelExpenseReceiptInput) travelExpenseReceiptInput.value = "";
  if (!travelExpenseReceiptPreview) return;

  if (!travelExpenseReceipt) {
    travelExpenseReceiptPreview.textContent = "Nenhum comprovante anexado.";
    if (removeTravelExpenseReceipt) removeTravelExpenseReceipt.hidden = true;
    return;
  }

  const name = travelExpenseReceipt.fileName || "Comprovante anexado";
  const size = travelExpenseReceipt.size ? ` (${Math.round(travelExpenseReceipt.size / 1024)} KB)` : "";
  travelExpenseReceiptPreview.innerHTML = travelExpenseReceipt.dataUrl
    ? `<span>${escapeHtml(name)}${size}</span><a href="${travelExpenseReceipt.dataUrl}" target="_blank" rel="noopener">Abrir</a>`
    : `<span>${escapeHtml(name)}${size}</span><strong>Salvo online</strong>`;
  if (removeTravelExpenseReceipt) removeTravelExpenseReceipt.hidden = false;
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressReceiptImage(file) {
  const source = await fileToDataUrl(file);
  const image = await loadImage(source);
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  return {
    fileName: file.name || "comprovante-despesa.jpg",
    mimeType: "image/jpeg",
    size: Math.round((dataUrl.length * 3) / 4),
    capturedAt: new Date().toISOString(),
    dataUrl,
    hasFile: true,
  };
}

function normalizeRecordSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function compactRecordSearchText(value) {
  return normalizeRecordSearchText(value).replace(/[^a-z0-9]/g, "");
}

function recordSearchHaystack(record) {
  const createdAt = record.createdAt ? new Date(record.createdAt) : null;
  const createdLocal = createdAt && !Number.isNaN(createdAt.getTime())
    ? createdAt.toLocaleString("pt-BR")
    : "";
  const fuels = Array.isArray(record.fuels)
    ? record.fuels.flatMap((fuel) => [
        fuel.fuelType,
        fuel.vehiclePlate,
        fuel.km,
        fuel.liters,
        fuel.invoiceKey,
      ])
    : [];
  const loads = normalizedLoadEntries(record).flatMap((load) => [
    load.quantity,
    load.invoiceKey,
    load.invoiceNumber,
  ]);

  return [
    record.id,
    record.createdAt,
    createdLocal,
    record.driverName,
    record.companyName,
    record.horsePlate,
    record.trailerPlate,
    record.tripDate,
    record.tripEndDate,
    record.startKm,
    record.finalKm,
    record.status,
    record.syncStatus,
    ...fuels,
    ...loads,
  ].join(" ");
}

function recordMatchesSearch(record, query) {
  const term = normalizeRecordSearchText(query).trim();
  if (!term) return true;
  const haystack = normalizeRecordSearchText(recordSearchHaystack(record));
  if (haystack.includes(term)) return true;
  const compactTerm = compactRecordSearchText(term);
  return Boolean(compactTerm && compactRecordSearchText(haystack).includes(compactTerm));
}

function renderRecords() {
  if (!records.length) {
    recordsList.innerHTML = "<p>Nenhum registro salvo ainda.</p>";
    return;
  }

  const searchTerm = recordSearchInput?.value || "";
  const filteredRecords = records.filter((record) => recordMatchesSearch(record, searchTerm));
  if (!filteredRecords.length) {
    recordsList.innerHTML = '<p>Nenhuma viagem encontrada. Baixe a base online e tente buscar pela data, hora, placa ou motorista.</p>';
    return;
  }

  const limit = searchTerm.trim() ? 40 : 8;
  const visibleRecords = filteredRecords.slice(0, limit);
  const summaryText = searchTerm.trim()
    ? `Mostrando ${visibleRecords.length} de ${filteredRecords.length} viagem(ns) encontrada(s).`
    : `Mostrando os ${visibleRecords.length} registros mais recentes de ${records.length}. Use a busca para encontrar viagens antigas.`;

  recordsList.innerHTML = `
    <p class="records-list-summary">${escapeHtml(summaryText)}</p>
    ${visibleRecords
    .map(
      (record) => {
        const fuels = record.fuels || [];
        const fuelSummary = fuels.length
          ? fuels
              .map(
                (fuel) =>
                  `${fuel.fuelType || "DIESEL S10"} ${fuel.vehiclePlate || record.horsePlate || "-"} / KM ${fuel.km || "-"} / ${fuel.liters || "-"} L / ${money(fuel.value)}`
              )
              .join(" | ")
          : record.fuelKm || "-";
        const [statusText, statusClass] = syncLabel(record.syncStatus, record.status);
        const receiptText = receiptHasFile(record.travelExpenseReceipt) ? " | Comprovante: anexado" : "";
        const loadText = loadSummaryText(record);
        const telemetry = vehicleTelemetry(record);
        const telemetryText = telemetry
          ? `<span>Torre: KM ${escapeHtml(kmText(telemetry.odometerKm))} | Diesel ${escapeHtml(percentText(telemetry.dieselPct))} | Arla ${escapeHtml(percentText(telemetry.arlaPct))}</span>`
          : "";
        const canShare = record.syncStatus !== "draft" && record.status !== "canceled";
        const shareAction = canShare
          ? `<button class="secondary whatsapp-button" type="button" data-whatsapp-record-id="${record.id}">Reenviar PDF</button>`
          : "";
        const adminActions =
          isAdmin() && canShare
            ? `
                <button class="secondary" type="button" data-edit-record-id="${record.id}">Editar</button>
                <button class="secondary danger-button" type="button" data-cancel-record-id="${record.id}">Cancelar</button>
              `
            : "";
        const recordActions = shareAction || adminActions
          ? `<div class="record-actions-inline">${shareAction}${adminActions}</div>`
          : "";

        return `
        <article class="record-item ${record.status === "canceled" ? "record-canceled" : ""}">
          <strong>${escapeHtml(record.driverName)} - ${escapeHtml(record.horsePlate)} / ${escapeHtml(record.trailerPlate)}</strong>
          <span>KM: ${escapeHtml(record.startKm || "-")} até ${escapeHtml(record.finalKm || "-")}</span>
          <span>Período: ${escapeHtml(record.tripDate || "-")} até ${escapeHtml(record.tripEndDate || "-")}</span>
          <span>Abastecimentos: ${escapeHtml(fuelSummary)}</span>
          <span>Frete: ${money(record.freightValue)} | Despesas: ${money(record.travelExpenses)}${receiptText}</span>
          <span>Caixinha: ${money(record.vehicleCash)} | Carregamentos: ${escapeHtml(loadText)}</span>
          ${telemetryText}
          <span>Criado em: ${new Date(record.createdAt).toLocaleString("pt-BR")} | ID: ${escapeHtml(record.id || "-")}</span>
          <span class="sync-badge ${statusClass}">${statusText}</span>
          ${record.syncStatus === "draft" ? `<button class="secondary reopen-draft-button" type="button" data-draft-id="${record.id}">Reabrir viagem</button>` : ""}
          ${recordActions}
        </article>
      `;
      }
    )
    .join("")}`;
}

function tripDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

function selectedDriverCosts(driverName) {
  const driver = driverRegistry(driverName);
  return {
    monthlySalary: Number(driver?.monthlySalary || 0),
    dailyRate: Number(driver?.dailyRate || 0),
    tripCommission: Number(driver?.tripCommission || 0),
  };
}

function maintenanceFormToRecord() {
  const data = new FormData(maintenanceForm);
  const driverName = isAdmin()
    ? normalizeDriverLoginName(data.get("maintenanceDriverName"))
    : driverNameFromLogin();
  const driver = driverRegistry(driverName);
  const companyName = String(data.get("maintenanceCompanyName") || driver?.company || "").toUpperCase();
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    createdByUserId: currentUser?.id || "",
    createdByEmail: currentUser?.email || "",
    maintenanceDate: data.get("maintenanceDate"),
    maintenanceType: String(data.get("maintenanceType") || "PREVENTIVA").toUpperCase(),
    driverName,
    companyName,
    vehiclePlate: String(data.get("maintenanceVehiclePlate") || "").toUpperCase(),
    vehicleType: String(data.get("maintenanceVehicleType") || "CAVALO").toUpperCase(),
    km: data.get("maintenanceKm"),
    description: String(data.get("maintenanceDescription") || "").trim(),
    notes: String(data.get("maintenanceNotes") || "").trim(),
    syncStatus: "pending",
    status: "active",
  };
}

function renderMaintenanceRecords() {
  if (!maintenanceList) return;
  if (!maintenanceRecords.length) {
    maintenanceList.innerHTML = "<p>Nenhuma manutencao informada ainda.</p>";
    return;
  }

  maintenanceList.innerHTML = maintenanceRecords
    .slice(0, 8)
    .map((record) => {
      const [statusText, statusClass] = syncLabel(record.syncStatus, record.status);
      return `
        <article class="record-item">
          <strong>${escapeHtml(record.maintenanceType)} - ${escapeHtml(record.vehiclePlate)}</strong>
          <span>${escapeHtml(record.driverName)} | ${escapeHtml(record.companyName || "-")}</span>
          <span>Data: ${escapeHtml(record.maintenanceDate || "-")} | KM: ${escapeHtml(record.km || "-")}</span>
          <span>${escapeHtml(record.description || "-")}</span>
          <span class="sync-badge ${statusClass}">${statusText}</span>
        </article>
      `;
    })
    .join("");
}

function resetMaintenanceForm() {
  if (!maintenanceForm) return;
  maintenanceForm.reset();
  setDefaultMaintenanceDate();
  applyDriverLoginLock();
}

function currentEditor() {
  return {
    userId: currentUser?.id || "",
    email: currentUser?.email || "",
    name: currentUser?.user_metadata?.display_name || currentUser?.user_metadata?.name || currentUser?.email || "",
  };
}

function auditEntry(action, reason) {
  return {
    action,
    reason: String(reason || "").trim(),
    at: new Date().toISOString(),
    by: currentEditor(),
  };
}

function currentEditingId() {
  return editingFinalizedId || editingDraftId;
}

function formToRecord(existingId = "") {
  const data = new FormData(form);
  const existing = existingId ? records.find((record) => record.id === existingId) : null;
  const startDate = data.get("tripDate");
  const endDate = data.get("tripEndDate");
  const driverName = isAdmin() ? normalizeDriverLoginName(data.get("driverName")) : driverNameFromLogin();
  const driverCosts = selectedDriverCosts(driverName);
  const dailyCount = tripDays(startDate, endDate);
  const loadEntriesData = collectLoadEntries();
  const loadAmountTotal = loadEntriesData.reduce((total, load) => total + Number(load.amount || 0), 0);
  const loadInvoiceKeys = loadEntriesData.map((load) => load.invoiceKey).filter(Boolean).join(" | ");
  return {
    id: existingId || crypto.randomUUID(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    createdByUserId: existing?.createdByUserId || currentUser?.id || "",
    createdByEmail: existing?.createdByEmail || currentUser?.email || "",
    horsePlate: String(data.get("horsePlate") || "").toUpperCase(),
    trailerPlate: String(data.get("trailerPlate") || "").toUpperCase(),
    driverName,
    companyName: String(data.get("companyName") || "").toUpperCase(),
    vehicleCategory: String(data.get("vehicleCategory") || "").toUpperCase(),
    vehicleCash: data.get("vehicleCash"),
    freightValue: data.get("freightValue"),
    travelExpenses: data.get("travelExpenses"),
    travelExpenseReceipt: travelExpenseReceipt ? { ...travelExpenseReceipt } : null,
    tripDate: startDate,
    tripEndDate: endDate,
    dailyCount,
    driverCosts,
    salaryTripCost: driverCosts.monthlySalary / 30 * dailyCount,
    dailyAllowanceCost: driverCosts.dailyRate * dailyCount,
    commissionValue: driverCosts.tripCommission,
    startKm: data.get("startKm"),
    fuels: collectFuelEntries(),
    loadEntries: loadEntriesData,
    loadAmount: loadAmountTotal || loadEntriesData[0]?.amount || "",
    loadInvoiceKey: loadInvoiceKeys || loadEntriesData[0]?.invoiceKey || "",
    finalKm: data.get("finalKm"),
    torreVehicle: existing?.torreVehicle || null,
    torreVehicleCapturedAt: existing?.torreVehicleCapturedAt || "",
    torreVehicleError: existing?.torreVehicleError || "",
    torreTrip: existing?.torreTrip || null,
    torreTripCapturedAt: existing?.torreTripCapturedAt || "",
    torreTripError: existing?.torreTripError || "",
    status: existing?.status === "canceled" ? "" : existing?.status || "active",
    editHistory: Array.isArray(existing?.editHistory) ? existing.editHistory : [],
  };
}

function validateKm(record) {
  const start = Number(record.startKm || 0);
  const final = Number(record.finalKm || 0);

  if (record.tripEndDate && record.tripDate && record.tripEndDate < record.tripDate) {
    return "A data final deve ser igual ou posterior à data inicial.";
  }
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
  const editingId = currentEditingId();
  const record = formToRecord(editingId);
  const kmError = validateKm(record);

  if (kmError) {
    showToast(kmError);
    return;
  }

  record.syncStatus = "pending";
  record.status = "active";
  if (editingFinalizedId) {
    record.editedAt = new Date().toISOString();
    record.editedBy = currentEditor();
    record.editHistory = [...(record.editHistory || []), auditEntry("editada", pendingEditReason)];
  }
  showToast("Consultando dados da Torre de Controle...");
  await enrichRecordWithVehicleTelemetry(record);
  records = editingId
    ? records.map((item) => item.id === editingId ? record : item)
    : [record, ...records];
  editingDraftId = "";
  editingFinalizedId = "";
  pendingEditReason = "";
  saveRecords();
  renderRecords();
  form.reset();
  resetFuelEntries();
  resetLoadEntries();
  resetTravelExpenseReceipt();
  setDefaultTripDate();
  applyDriverLoginLock();
  resetTripAccordion();
  showToast(editingId ? "Viagem atualizada. Preparando PDF..." : "Registro salvo. Preparando PDF...");
  try {
    await shareTripOnWhatsApp(record);
  } catch (error) {
    showToast("Viagem salva, mas o PDF nao foi compartilhado.");
  }
  showToast("Enviando viagem para a base online...");
  const synced = await syncRecord(record.id);
  showToast(synced ? "Viagem salva na base online." : "Viagem salva no aparelho. Envio pendente.");
});

function fillTripForm(record) {
  const values = {
    horsePlate: record.horsePlate,
    trailerPlate: record.trailerPlate,
    driverName: record.driverName,
    companyName: record.companyName,
    vehicleCategory: record.vehicleCategory,
    vehicleCash: record.vehicleCash,
    freightValue: record.freightValue,
    travelExpenses: record.travelExpenses,
    tripDate: record.tripDate,
    tripEndDate: record.tripEndDate,
    startKm: record.startKm,
    finalKm: record.finalKm,
  };
  Object.entries(values).forEach(([name, value]) => {
    const field = form.elements.namedItem(name);
    if (field) field.value = value || "";
  });
  resetFuelEntries(record.fuels || []);
  resetLoadEntries(normalizedLoadEntries(record));
  resetTravelExpenseReceipt(record.travelExpenseReceipt || null);
  applyDriverLoginLock();
  resetTripAccordion();
}

saveDraftButton.addEventListener("click", () => {
  if (editingFinalizedId) {
    showToast("Viagem finalizada deve ser salva em Finalizar viagem.");
    return;
  }
  const record = formToRecord(editingDraftId);
  record.syncStatus = "draft";
  record.updatedAt = new Date().toISOString();
  records = editingDraftId
    ? records.map((item) => item.id === editingDraftId ? record : item)
    : [record, ...records];
  editingDraftId = "";
  saveRecords();
  renderRecords();
  form.reset();
  resetFuelEntries();
  resetLoadEntries();
  resetTravelExpenseReceipt();
  setDefaultTripDate();
  applyDriverLoginLock();
  resetTripAccordion();
  showToast("Viagem salva como rascunho.");
});

recordsList.addEventListener("click", async (event) => {
  const draftButton = event.target.closest("[data-draft-id]");
  const editButton = event.target.closest("[data-edit-record-id]");
  const cancelButton = event.target.closest("[data-cancel-record-id]");
  const whatsappButton = event.target.closest("[data-whatsapp-record-id]");

  if (whatsappButton) {
    const record = records.find((item) => item.id === whatsappButton.dataset.whatsappRecordId);
    if (!record || record.syncStatus === "draft" || record.status === "canceled") return;
    const originalText = whatsappButton.textContent;
    whatsappButton.disabled = true;
    whatsappButton.textContent = "Preparando...";
    showToast("Atualizando dados da Torre e gerando PDF...");
    try {
      await enrichRecordWithVehicleTelemetry(record);
      saveRecords();
      renderRecords();
      await shareTripOnWhatsApp(record);
      showToast("Resumo em PDF pronto para envio.");
    } catch (error) {
      showToast("Nao foi possivel compartilhar o PDF. Tente novamente.");
    } finally {
      whatsappButton.disabled = false;
      whatsappButton.textContent = originalText;
    }
    return;
  }

  if (draftButton) {
    const draft = records.find((record) => record.id === draftButton.dataset.draftId);
    if (!draft) return;
    editingDraftId = draft.id;
    editingFinalizedId = "";
    pendingEditReason = "";
    fillTripForm(draft);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("Rascunho reaberto para continuar.");
    return;
  }

  if (editButton) {
    if (!isAdmin()) return;
    const record = records.find((item) => item.id === editButton.dataset.editRecordId);
    if (!record || record.status === "canceled") return;
    const reason = window.prompt("Informe o motivo da edição desta viagem:");
    if (!reason?.trim()) {
      showToast("Informe um motivo para editar.");
      return;
    }
    editingFinalizedId = record.id;
    editingDraftId = "";
    pendingEditReason = reason.trim();
    fillTripForm(record);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("Viagem finalizada aberta para edição.");
    return;
  }

  if (cancelButton) {
    if (!isAdmin()) return;
    const record = records.find((item) => item.id === cancelButton.dataset.cancelRecordId);
    if (!record || record.status === "canceled") return;
    const reason = window.prompt("Informe o motivo do cancelamento desta viagem:");
    if (!reason?.trim()) {
      showToast("Informe um motivo para cancelar.");
      return;
    }
    if (!window.confirm("Confirmar cancelamento desta viagem? Ela sairá dos cálculos do dashboard.")) return;
    record.status = "canceled";
    record.canceledAt = new Date().toISOString();
    record.canceledBy = currentEditor();
    record.cancelReason = reason.trim();
    record.editHistory = [...(record.editHistory || []), auditEntry("cancelada", reason)];
    record.syncStatus = "pending";
    record.centralSyncVersion = 0;
    saveRecords();
    renderRecords();
    showToast("Viagem cancelada. Enviando atualização...");
    const synced = await syncRecord(record.id);
    showToast(synced ? "Cancelamento salvo na base online." : "Cancelamento salvo no aparelho. Envio pendente.");
  }
});

clearButton.addEventListener("click", () => {
  editingDraftId = "";
  editingFinalizedId = "";
  pendingEditReason = "";
  form.reset();
  resetFuelEntries();
  resetLoadEntries();
  resetTravelExpenseReceipt();
  setDefaultTripDate();
  applyDriverLoginLock();
  resetTripAccordion();
  showToast("Campos limpos.");
});

travelExpenseReceiptInput?.addEventListener("change", async () => {
  const file = travelExpenseReceiptInput.files && travelExpenseReceiptInput.files[0];
  if (!file) {
    resetTravelExpenseReceipt();
    return;
  }
  if (!file.type.startsWith("image/")) {
    showToast("Selecione uma imagem do recibo ou nota.");
    resetTravelExpenseReceipt();
    return;
  }
  try {
    travelExpenseReceiptPreview.textContent = "Preparando foto...";
    const receipt = await compressReceiptImage(file);
    resetTravelExpenseReceipt(receipt);
    showToast("Comprovante anexado.");
  } catch (error) {
    resetTravelExpenseReceipt();
    showToast("Nao foi possivel anexar a foto.");
  }
});

removeTravelExpenseReceipt?.addEventListener("click", () => {
  resetTravelExpenseReceipt();
  showToast("Comprovante removido.");
});

maintenanceForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const record = maintenanceFormToRecord();
  if (!record.driverName || !record.companyName || !record.vehiclePlate || !record.description) {
    showToast("Preencha motorista, empresa, placa e descricao.");
    return;
  }

  maintenanceRecords = [record, ...maintenanceRecords];
  saveMaintenanceRecords();
  renderMaintenanceRecords();
  resetMaintenanceForm();
  maintenanceStatus.textContent = "Manutencao salva neste aparelho. Sincronizando...";
  const synced = await syncMaintenanceRecord(record.id);
  maintenanceStatus.textContent = synced
    ? "Manutencao salva na base online."
    : "Manutencao salva no aparelho. Envio pendente.";
});

clearMaintenanceButton?.addEventListener("click", () => {
  resetMaintenanceForm();
  showToast("Campos de manutencao limpos.");
});

addFuelButton.addEventListener("click", () => createFuelEntry());
addLoadButton.addEventListener("click", () => createLoadEntry());
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
  const isDriver = activeRegistryType === "drivers";
  const isHorse = activeRegistryType === "horses";
  const hasCompanyCategory = activeRegistryType !== "trailers";
  const item = {
    id: current?.id || crypto.randomUUID(),
    name,
    company: hasCompanyCategory ? registryCompany.value.trim().toUpperCase() : "",
    category: hasCompanyCategory ? registryCategory.value.trim().toUpperCase() : "",
    monthlySalary: isDriver ? Number(registrySalary.value || 0) : 0,
    dailyRate: isDriver ? Number(registryDailyRate.value || 0) : 0,
    tripCommission: isDriver ? Number(registryCommission.value || 0) : 0,
    ruim: isHorse ? Number(registryReferenceBad.value || 0) : Number(current?.ruim || 0),
    regular: isHorse ? Number(registryReferenceGood.value || 0) : Number(current?.regular || 0),
    excelente: isHorse ? Number(registryReferenceExcellent.value || 0) : Number(current?.excelente || 0),
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
    registrySalary.value = item.monthlySalary || "";
    registryDailyRate.value = item.dailyRate || "";
    registryCommission.value = item.tripCommission || "";
    registryReferenceBad.value = item.ruim || "";
    registryReferenceGood.value = item.regular || "";
    registryReferenceExcellent.value = item.excelente || "";
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

loadEntries.addEventListener("click", (event) => {
  if (!event.target.classList.contains("remove-load-button")) return;
  event.target.closest(".load-entry").remove();
  updateLoadRemoveButtons();
});

document.addEventListener("click", (event) => {
  const fetchButton = event.target.closest("[data-nfe-fetch]");
  if (fetchButton) {
    fetchNfeForEntry(fetchButton);
    return;
  }
  const importButton = event.target.closest("[data-nfe-import]");
  if (importButton) {
    importButton.closest(".fuel-entry")?.querySelector(".nfe-xml-input")?.click();
  }
});

document.addEventListener("change", (event) => {
  if (event.target.classList.contains("nfe-xml-input")) {
    importNfeXmlForEntry(event.target);
  }
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
  const telemetry = vehicleTelemetry(record) || {};
  const tripHistory = vehicleTripHistory(record) || {};
  const motoristaKm = driverTripKm(record);
  const motoristaLiters = driverTripLiters(record);
  const motoristaAverage = driverTripAverage(record);

  return {
    ID: record.id,
    DataHora: record.createdAt,
    Data: date.toLocaleDateString("pt-BR"),
    "Data Final": record.tripEndDate || "",
    Motorista: String(record.driverName || "").toUpperCase(),
    Empresa: record.companyName || "",
    "Placa Cavalo": record.horsePlate || "",
    "Placa Carreta": record.trailerPlate || "",
    Categoria: record.vehicleCategory || "",
    "KM Inicial": startKm || "",
    "KM Final": finalKm || "",
    "KM Rodado": finalKm >= startKm ? finalKm - startKm : "",
    Caixinha: Number(record.vehicleCash || 0),
    Frete: Number(record.freightValue || 0),
    "Despesas da Viagem": Number(record.travelExpenses || 0),
    "Comprovante Despesa": receiptHasFile(record.travelExpenseReceipt) ? "SIM" : "NAO",
    "Arquivo Comprovante": record.travelExpenseReceipt?.fileName || "",
    "Chave Anexo Comprovante": record.travelExpenseReceipt?.attachmentKey || "",
    Diárias: Number(record.dailyCount || 0),
    "Valor das Diárias": Number(record.dailyAllowanceCost || 0),
    Comissão: Number(record.commissionValue || 0),
    "Salário Proporcional": Number(record.salaryTripCost || 0),
    "Quantidade Carregada": loadTotal(record) || Number(record.loadAmount || 0),
    "Chave NF Carregamento": loadInvoiceSummary(record) || record.loadInvoiceKey || "",
    Status: record.status === "canceled" ? "CANCELADA" : "ATIVA",
    "Motivo Cancelamento": record.cancelReason || "",
    "Editado em": record.editedAt || "",
    "Torre KM Veiculo": Number(telemetry.odometerKm || 0) || "",
    "Torre Diesel %": Number(telemetry.dieselPct || 0) || "",
    "Torre Arla %": Number(telemetry.arlaPct || 0) || "",
    "Torre Velocidade Atual": Number(telemetry.speedKmh || 0) || "",
    "Torre Vmax 24h": Number(telemetry.vmax24Kmh || 0) || "",
    "Torre % Acima 100": Number(telemetry.pctAbove100 || 0) || "",
    "Torre Atualizado em": telemetry.updatedAt || "",
    "Torre Historico Status": tripHistory.available ? "OK" : tripHistory.reason || "",
    "Torre KM Viagem": Number(tripHistory.km || 0) || "",
    "Motorista KM Viagem": motoristaKm ?? "",
    "Diferenca KM Torre": motoristaKm !== null && Number.isFinite(Number(tripHistory.km))
      ? Number(tripHistory.km) - motoristaKm
      : "",
    "Torre Litros Viagem": Number(tripHistory.liters || 0) || "",
    "Motorista Litros Viagem": motoristaLiters ?? "",
    "Torre Media KM/L Viagem": Number(tripHistory.kmPerLiter || 0) || "",
    "Motorista Media KM/L Viagem": motoristaAverage ?? "",
    "Torre Vmax Viagem": Number(tripHistory.vmaxKmh || 0) || "",
    "Torre % Acima 100 Viagem": Number(tripHistory.pctAbove100 || 0) || "",
    "Torre Diesel Final %": Number(tripHistory.dieselEndPct || 0) || "",
    "Torre Arla Final %": Number(tripHistory.arlaEndPct || 0) || "",
    "Torre Amostras Viagem": Number(tripHistory.samples || 0) || "",
    "Histórico": (record.editHistory || []).map((item) => `${item.at || ""} - ${item.action || ""}: ${item.reason || ""}`).join(" | "),
  };
}

function fuelExcelRows(record) {
  const date = recordDate(record);
  return (record.fuels || []).map((fuel, index) => ({
    ID: `${record.id}-AB${index + 1}`,
    "Viagem ID": record.id,
    DataHora: record.createdAt,
    Data: date.toLocaleDateString("pt-BR"),
    "Data Abastecimento": fuel.date || "",
    Motorista: String(record.driverName || "").toUpperCase(),
    Empresa: record.companyName || "",
    "Placa Cavalo": record.horsePlate || "",
    "Placa Abastecida": fuel.vehiclePlate || record.horsePlate || "",
    Combustível: fuel.fuelType || "DIESEL S10",
    KM: Number(fuel.km || 0) || "",
    Litros: Number(fuel.liters || 0) || "",
    "Valor Combustível": Number(fuel.value || 0) || "",
    "Chave NF": fuel.invoiceKey || "",
    "Número NF": fuel.nfe?.numero || invoiceNumberFromKey(fuel.invoiceKey),
    "Emitente NF": fuel.nfe?.emitente || "",
    "CNPJ Emitente NF": fuel.nfe?.cnpjEmitente || "",
    "Produto NF": fuel.nfe?.products?.[0]?.description || "",
  }));
}

function loadExcelRows(record) {
  const date = recordDate(record);
  return normalizedLoadEntries(record).map((load, index) => ({
    ID: `${record.id}-CG${index + 1}`,
    "Viagem ID": record.id,
    DataHora: record.createdAt,
    Data: date.toLocaleDateString("pt-BR"),
    Motorista: String(record.driverName || "").toUpperCase(),
    Empresa: record.companyName || "",
    "Placa Cavalo": record.horsePlate || "",
    "Placa Carreta": record.trailerPlate || "",
    "Carregamento": index + 1,
    "Quantidade Carregada": Number(load.amount || 0) || "",
    "Chave NF": load.invoiceKey || "",
    "Número NF": load.nfe?.numero || invoiceNumberFromKey(load.invoiceKey),
    "Emitente NF": load.nfe?.emitente || "",
    "CNPJ Emitente NF": load.nfe?.cnpjEmitente || "",
    "Origem NF": load.nfe?.origem || "",
    "Destino NF": load.nfe?.destino || "",
    "Peso Bruto NF": Number(load.nfe?.pesoBruto || 0) || "",
    "Peso Líquido NF": Number(load.nfe?.pesoLiquido || 0) || "",
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
          "Salario Mensal": Number(item.monthlySalary || 0),
          "Valor Diaria": Number(item.dailyRate || 0),
          "Comissao por Viagem": Number(item.tripCommission || 0),
          Ativo: item.active ? "SIM" : "NAO",
          "Atualizado em": item.updatedAt || "",
        }
      : {
          ID: item.id,
          Placa: item.name,
          Empresa: item.company || "",
          Categoria: item.category || "",
          "Media KM/L Ruim": Number(item.ruim || 0),
          "Media KM/L Bom": Number(item.regular || 0),
          "Media KM/L Excelente": Number(item.excelente || 0),
          Ativo: item.active ? "SIM" : "NAO",
          "Atualizado em": item.updatedAt || "",
        }
  );
}

function maintenanceExcelRows(items = []) {
  return items.map((record) => ({
    ID: record.id,
    DataHora: record.createdAt || "",
    "Data Manutencao": record.maintenanceDate || "",
    Tipo: record.maintenanceType || "",
    Motorista: String(record.driverName || "").toUpperCase(),
    Empresa: record.companyName || "",
    "Placa Veiculo": record.vehiclePlate || "",
    Veiculo: record.vehicleType || "",
    KM: Number(record.km || 0) || "",
    Descricao: record.description || "",
    Observacao: record.notes || "",
    Status: record.status === "canceled" ? "CANCELADA" : "ATIVA",
  }));
}

function createOnlineWorkbook(data) {
  const workbook = XLSX.utils.book_new();
  const tripRows = data.records.map(tripExcelRow);
  const fuelRows = data.records.flatMap(fuelExcelRows);
  const loadRows = data.records.flatMap(loadExcelRows);
  const maintenanceRows = maintenanceExcelRows(data.maintenance || []);
  const addSheet = (name, rows, headers) => {
    const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    sheet["!cols"] = headers.map((header) => ({
      wch: Math.min(48, Math.max(12, header.length + 2)),
    }));
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  };

  addSheet("APP_VIAGENS", tripRows, [
    "ID", "DataHora", "Data", "Data Final", "Motorista", "Empresa", "Placa Cavalo",
    "Placa Carreta", "Categoria", "KM Inicial", "KM Final", "KM Rodado",
    "Caixinha", "Frete", "Despesas da Viagem", "Comprovante Despesa",
    "Arquivo Comprovante", "Chave Anexo Comprovante", "Diárias", "Valor das Diárias",
    "Comissão", "Salário Proporcional", "Quantidade Carregada", "Chave NF Carregamento",
    "Status", "Motivo Cancelamento", "Editado em", "Torre KM Veiculo", "Torre Diesel %",
    "Torre Arla %", "Torre Velocidade Atual", "Torre Vmax 24h", "Torre % Acima 100",
    "Torre Atualizado em", "Torre Historico Status", "Torre KM Viagem",
    "Motorista KM Viagem", "Diferenca KM Torre", "Torre Litros Viagem",
    "Motorista Litros Viagem", "Torre Media KM/L Viagem", "Motorista Media KM/L Viagem",
    "Torre Vmax Viagem", "Torre % Acima 100 Viagem", "Torre Diesel Final %",
    "Torre Arla Final %", "Torre Amostras Viagem", "Histórico",
  ]);
  addSheet("APP_ABASTECIMENTOS", fuelRows, [
    "ID", "Viagem ID", "DataHora", "Data", "Data Abastecimento", "Motorista", "Empresa",
    "Placa Cavalo", "Placa Abastecida", "Combustível", "KM", "Litros", "Valor Combustível", "Chave NF",
    "Número NF", "Emitente NF", "CNPJ Emitente NF", "Produto NF",
  ]);
  addSheet("APP_CARREGAMENTOS", loadRows, [
    "ID", "Viagem ID", "DataHora", "Data", "Motorista", "Empresa",
    "Placa Cavalo", "Placa Carreta", "Carregamento", "Quantidade Carregada", "Chave NF",
    "Número NF", "Emitente NF", "CNPJ Emitente NF", "Origem NF", "Destino NF", "Peso Bruto NF", "Peso Líquido NF",
  ]);
  addSheet("APP_MANUTENCOES", maintenanceRows, [
    "ID", "DataHora", "Data Manutencao", "Tipo", "Motorista", "Empresa",
    "Placa Veiculo", "Veiculo", "KM", "Descricao", "Observacao", "Status",
  ]);
  addSheet("CAD_MOTORISTAS", registryExcelRows(data.registries.drivers, "drivers"), [
    "ID", "Nome", "Empresa", "Categoria", "Salario Mensal", "Valor Diaria",
    "Comissao por Viagem", "Ativo", "Atualizado em",
  ]);
  addSheet("CAD_CAVALOS", registryExcelRows(data.registries.horses, "horses"), [
    "ID", "Placa", "Empresa", "Categoria", "Media KM/L Ruim", "Media KM/L Bom",
    "Media KM/L Excelente", "Ativo", "Atualizado em",
  ]);
  addSheet("CAD_CARRETAS", registryExcelRows(data.registries.trailers, "trailers"), [
    "ID", "Placa", "Ativo", "Atualizado em",
  ]);
  return workbook;
}

function mergeOnlineRecords(onlineRecords = []) {
  if (!Array.isArray(onlineRecords) || !onlineRecords.length) return;
  const byId = new Map(records.map((record) => [record.id, record]));
  onlineRecords.forEach((record) => {
    const current = byId.get(record.id);
    if (current?.syncStatus === "draft" || current?.syncStatus === "pending" || current?.syncStatus === "failed") {
      return;
    }
    byId.set(record.id, {
      ...record,
      syncStatus: "synced",
      centralSyncVersion: 1,
      syncedAt: record.syncedAt || record.updatedAt || record.createdAt || new Date().toISOString(),
    });
  });
  records = [...byId.values()].sort((a, b) =>
    String(b.editedAt || b.canceledAt || b.createdAt).localeCompare(String(a.editedAt || a.canceledAt || a.createdAt))
  );
  saveRecords();
  renderRecords();
}

function mergeOnlineMaintenance(onlineRecords = []) {
  if (!Array.isArray(onlineRecords) || !onlineRecords.length) return;
  const byId = new Map(maintenanceRecords.map((record) => [record.id, record]));
  onlineRecords.forEach((record) => {
    const current = byId.get(record.id);
    if (current?.syncStatus === "pending" || current?.syncStatus === "failed") {
      return;
    }
    byId.set(record.id, {
      ...record,
      syncStatus: "synced",
      centralSyncVersion: 1,
      syncedAt: record.syncedAt || record.updatedAt || record.createdAt || new Date().toISOString(),
    });
  });
  maintenanceRecords = [...byId.values()].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt))
  );
  saveMaintenanceRecords();
  renderMaintenanceRecords();
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

    mergeOnlineRecords(data.records || []);
    mergeOnlineMaintenance(data.maintenance || []);
    const workbook = createOnlineWorkbook(data);
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Base_TAZ_online_${stamp}.xlsx`);
    excelStatus.textContent = `Base baixada com ${data.records.length} viagem(ns) e ${(data.maintenance || []).length} manutencao(oes).`;
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

  if (!records.length && !maintenanceRecords.length) {
    excelStatus.textContent = "Nao existem viagens ou manutencoes salvas neste aparelho.";
    return;
  }

  try {
    excelStatus.textContent = "Atualizando a planilha...";
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const currentTrips = sheetRows(workbook, "APP_VIAGENS");
    const currentFuels = sheetRows(workbook, "APP_ABASTECIMENTOS");
    const currentLoads = sheetRows(workbook, "APP_CARREGAMENTOS");
    const currentMaintenance = sheetRows(workbook, "APP_MANUTENCOES");
    const tripIds = new Set(currentTrips.map((row) => String(row.ID || "")));
    const fuelIds = new Set(currentFuels.map((row) => String(row.ID || "")));
    const loadIds = new Set(currentLoads.map((row) => String(row.ID || "")));
    const maintenanceIds = new Set(currentMaintenance.map((row) => String(row.ID || "")));
    const completedRecords = records.filter((record) => record.syncStatus !== "draft");
    const newTrips = completedRecords.map(tripExcelRow).filter((row) => !tripIds.has(row.ID));
    const newFuels = completedRecords
      .flatMap(fuelExcelRows)
      .filter((row) => !fuelIds.has(row.ID));
    const newLoads = completedRecords
      .flatMap(loadExcelRows)
      .filter((row) => !loadIds.has(row.ID));
    const newMaintenance = maintenanceExcelRows(maintenanceRecords)
      .filter((row) => !maintenanceIds.has(row.ID));

    replaceSheet(
      workbook,
      "APP_VIAGENS",
      [...currentTrips, ...newTrips],
      [
        "ID",
        "DataHora",
        "Data",
        "Data Final",
        "Motorista",
        "Empresa",
        "Placa Cavalo",
        "Placa Carreta",
        "Categoria",
        "KM Inicial",
        "KM Final",
        "KM Rodado",
        "Caixinha",
        "Frete",
        "Despesas da Viagem",
        "Comprovante Despesa",
        "Arquivo Comprovante",
        "Chave Anexo Comprovante",
        "Diárias",
        "Valor das Diárias",
        "Comissão",
        "Salário Proporcional",
        "Quantidade Carregada",
        "Chave NF Carregamento",
        "Status",
        "Motivo Cancelamento",
        "Editado em",
        "Histórico",
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
        "Data Abastecimento",
        "Motorista",
        "Empresa",
        "Placa Cavalo",
        "Placa Abastecida",
        "Combustível",
        "KM",
        "Litros",
        "Valor Combustível",
        "Chave NF",
        "Número NF",
        "Emitente NF",
        "CNPJ Emitente NF",
        "Produto NF",
      ]
    );
    replaceSheet(
      workbook,
      "APP_CARREGAMENTOS",
      [...currentLoads, ...newLoads],
      [
        "ID",
        "Viagem ID",
        "DataHora",
        "Data",
        "Motorista",
        "Empresa",
        "Placa Cavalo",
        "Placa Carreta",
        "Carregamento",
        "Quantidade Carregada",
        "Chave NF",
        "Número NF",
        "Emitente NF",
        "CNPJ Emitente NF",
        "Origem NF",
        "Destino NF",
        "Peso Bruto NF",
        "Peso Líquido NF",
      ]
    );
    replaceSheet(
      workbook,
      "APP_MANUTENCOES",
      [...currentMaintenance, ...newMaintenance],
      [
        "ID",
        "DataHora",
        "Data Manutencao",
        "Tipo",
        "Motorista",
        "Empresa",
        "Placa Veiculo",
        "Veiculo",
        "KM",
        "Descricao",
        "Observacao",
        "Status",
      ]
    );

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Consolidado_TAZ_atualizado_${stamp}.xlsx`);
    excelStatus.textContent = `Planilha gerada: ${newTrips.length} viagem(ns), ${newFuels.length} abastecimento(s), ${newLoads.length} carregamento(s) e ${newMaintenance.length} manutencao(oes) adicionados.`;
  } catch (error) {
    excelStatus.textContent = `Não foi possível atualizar a planilha: ${error.message}`;
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js");
}

recordSearchInput?.addEventListener("input", () => renderRecords());

resetFuelEntries();
resetLoadEntries();
resetTravelExpenseReceipt();
setDefaultTripDate();
resetTripAccordion();
setDefaultMaintenanceDate();
renderRecords();
renderMaintenanceRecords();
renderRegistryUi();
initializeAuth();


