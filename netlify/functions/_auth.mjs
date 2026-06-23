const SUPABASE_URL = "https://txwsqgojfaiivpffgclw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_GiOI31fiyA37jAGoOJyKuA_bovc7GwN";

export async function authenticatedUser(request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      authorization,
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
  });
  if (!response.ok) return null;
  return response.json();
}

export function userRole(user) {
  return String(user?.user_metadata?.role || "motorista").toLowerCase();
}

export function normalizeCompany(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export function userCompanies(user) {
  const metadata = user?.user_metadata || {};
  const raw = metadata.companies || metadata.company || metadata.empresa || [];
  const values = Array.isArray(raw) ? raw : String(raw).split(",");
  return values.map(normalizeCompany).filter(Boolean);
}

export function canViewAll(user) {
  return userRole(user) === "admin" || userCompanies(user).includes("*");
}

export function companyAllowed(value, companies = []) {
  if (companies.includes("*")) return true;
  return companies.includes(normalizeCompany(value));
}
