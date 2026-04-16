import { ENABLE_BACKEND, callApi, isNetworkError } from "./httpClient";
import { getUsers, initMockStore, setUsers } from "./mockStore";
import { addActivityLog } from "./workflowService";
import { normalizeRole } from "../utils/roleUtils";

const createMockToken = (user) => `mock-token-${user.id}-${Date.now()}`;
const DEFAULT_EMPLOYEE_PASSWORD = "password123";
const isBackendTimeoutError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("etimedout") ||
    message.includes("server selection timed out") ||
    message.includes("failed to connect") ||
    message.includes("econnrefused") ||
    message.includes("ehostunreach") ||
    message.includes("connect timeout")
  );
};

const publicUser = (user) => ({
  id: user.id,
  fullName: user.fullName || user.name,
  email: user.email,
  role: normalizeRole(user.role, user.email),
  department: user.department,
});

const findMockUserByIdentifier = (users, identifier) => {
  const normalized = String(identifier || "").trim().toLowerCase();
  if (!normalized) return null;

  const exact = users.find(
    (item) => String(item.email || "").toLowerCase() === normalized,
  );
  if (exact) return exact;

  const localPart = normalized.split("@")[0];
  const localPartMatches = users.filter((item) =>
    String(item.email || "").toLowerCase().startsWith(`${localPart}@`),
  );

  if (localPartMatches.length === 1) return localPartMatches[0];
  return null;
};

const loginWithMock = async ({ email, password }) => {
  initMockStore();
  const users = getUsers();
  const match = findMockUserByIdentifier(users, email);
  const normalizedPassword = String(password || "").trim();

  if (!match) {
    throw new Error("Invalid email or password");
  }
  if (String(match.status || "Active").toLowerCase() === "inactive") {
    throw new Error("Your account is inactive. Please contact admin.");
  }

  const storedPassword = String(match.password || "").trim();
  const isEmployee = normalizeRole(match.role, match.email) !== "admin";
  const canUseDefaultEmployeePassword =
    isEmployee && normalizedPassword === DEFAULT_EMPLOYEE_PASSWORD;
  const hasValidStoredPassword =
    Boolean(storedPassword) && storedPassword === normalizedPassword;

  if (!hasValidStoredPassword && !canUseDefaultEmployeePassword) {
    throw new Error("Invalid email or password");
  }

  // Self-heal legacy/mock users that were missing a stored password.
  if (!storedPassword && canUseDefaultEmployeePassword) {
    const healedUsers = users.map((item) =>
      item.id === match.id ? { ...item, password: DEFAULT_EMPLOYEE_PASSWORD } : item,
    );
    setUsers(healedUsers);
  }

  const user = publicUser(match);
  addActivityLog({
    userName: user.fullName,
    role: user.role,
    action: "User logged in",
  });
  return { user, token: createMockToken(match) };
};

const registerWithMock = async ({
  fullName,
  email,
  password,
  role,
  department,
}) => {
  initMockStore();
  const users = getUsers();
  const exists = users.some(
    (item) => item.email.toLowerCase() === email.toLowerCase(),
  );

  if (exists) {
    throw new Error("Email already registered");
  }

  const newUser = {
    id: `u-${Date.now()}`,
    fullName,
    email,
    password,
    role: role === "admin" ? "admin" : "employee",
    department,
  };

  setUsers([newUser, ...users]);
  const user = publicUser(newUser);
  addActivityLog({
    userName: user.fullName,
    role: user.role,
    action: "User created",
    status: user.role,
  });
  return { user, token: createMockToken(newUser) };
};

export const loginUser = async (credentials) => {
  const normalizedCredentials = {
    email: String(credentials.email || "")
      .trim()
      .toLowerCase(),
    password: credentials.password,
  };
  try {
    return await callApi("/auth/login", {
      method: "POST",
      body: JSON.stringify(normalizedCredentials),
    });
  } catch (error) {
    const canFallback =
      !ENABLE_BACKEND || isNetworkError(error) || isBackendTimeoutError(error);

    if (!canFallback) throw error;

    try {
      // Backend can be absent in UI-only mode, so we keep a mock fallback.
      return await loginWithMock(normalizedCredentials);
    } catch (fallbackError) {
      if (ENABLE_BACKEND && isBackendTimeoutError(error)) {
        throw new Error(
          "Login service is temporarily unavailable. Please try again in a moment.",
        );
      }
      throw fallbackError;
    }
  }
};

export const registerUser = async (details) => {
  const payload = {
    name: details.fullName || details.name,
    email: String(details.email || "")
      .trim()
      .toLowerCase(),
    password: details.password,
    role: "employee",
    department: details.department,
  };

  try {
    return await callApi("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (ENABLE_BACKEND && /already exists/i.test(error.message || "")) {
      try {
        return await loginUser({
          email: payload.email,
          password: payload.password,
        });
      } catch {
        throw new Error(
          "Email already registered. Please sign in with your existing password.",
        );
      }
    }
    if (ENABLE_BACKEND && !isNetworkError(error) && !isBackendTimeoutError(error)) {
      throw error;
    }
    // Registration is also supported fully in-browser for demos.
    return registerWithMock(details);
  }
};

export const getLoginActivity = async () => {
  try {
    return await callApi("/auth/login-activity");
  } catch {
    return [];
  }
};
