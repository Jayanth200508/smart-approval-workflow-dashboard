const FIXED_ADMIN_EMAIL = "jayanth.se23@bitsathy.ac.in";

export const normalizeRole = (role, email = "") => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (normalizedEmail === FIXED_ADMIN_EMAIL) return "admin";
  if (role === "admin") return "admin";
  if (role === "manager") return "manager";
  return "employee";
};

export const getHomeRouteByRole = (role) =>
  normalizeRole(role) === "admin" ? "/admin/dashboard" : "/employee/dashboard";
