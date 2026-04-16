import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getLoginActivity,
  loginUser,
  registerUser,
} from "../services/authService";
import { normalizeRole } from "../utils/roleUtils";

const AuthContext = createContext(null);

const AUTH_STORAGE_KEY = "smart_approval_auth";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const normalizeUserShape = (candidate) => {
  if (!candidate) return null;
  const fullName = candidate.fullName || candidate.name || "";
  return {
    ...candidate,
    fullName,
    name: candidate.name || fullName,
    role: normalizeRole(candidate.role, candidate.email),
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [authError, setAuthError] = useState("");
  const [loginActivity, setLoginActivity] = useState([]);

  useEffect(() => {
    const rawAuthState = localStorage.getItem(AUTH_STORAGE_KEY);
    if (rawAuthState) {
      try {
        const parsed = JSON.parse(rawAuthState);
        const normalizedUser = normalizeUserShape(parsed.user);
        setUser(normalizedUser);
        setToken(parsed.token || "");
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setIsBootstrapping(false);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const syncActivity = async () => {
      const data = await getLoginActivity();
      setLoginActivity(Array.isArray(data) ? data : []);
    };
    syncActivity();
    return undefined;
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    let lastSeen = Date.now();
    const touch = () => {
      lastSeen = Date.now();
      localStorage.setItem("flowpilot_last_activity", String(lastSeen));
    };
    const timer = window.setInterval(() => {
      if (Date.now() - lastSeen > SESSION_TIMEOUT_MS) {
        clearAuth();
      }
    }, 60000);
    window.addEventListener("mousemove", touch);
    window.addEventListener("keydown", touch);
    window.addEventListener("click", touch);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("mousemove", touch);
      window.removeEventListener("keydown", touch);
      window.removeEventListener("click", touch);
    };
  }, [user]);

  const persistAuth = (nextUser, nextToken) => {
    const normalizedUser = normalizeUserShape(nextUser);
    setUser(normalizedUser);
    setToken(nextToken);
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ user: normalizedUser, token: nextToken }),
    );
  };

  const clearAuth = () => {
    setUser(null);
    setToken("");
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const login = async (credentials) => {
    setAuthError("");
    try {
      const payload = await loginUser(credentials);
      persistAuth(payload.user, payload.token);
      return payload.user;
    } catch (error) {
      setAuthError(error.message || "Unable to login");
      throw error;
    }
  };

  const register = async (details) => {
    setAuthError("");
    try {
      const payload = await registerUser(details);
      persistAuth(payload.user, payload.token);
      return payload.user;
    } catch (error) {
      setAuthError(error.message || "Unable to register");
      throw error;
    }
  };

  const logout = () => {
    clearAuth();
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      authError,
      login,
      register,
      logout,
      loginActivity,
      clearAuthError: () => setAuthError(""),
    }),
    [user, token, isBootstrapping, authError, loginActivity],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
