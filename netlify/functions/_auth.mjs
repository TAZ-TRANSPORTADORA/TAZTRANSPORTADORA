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
