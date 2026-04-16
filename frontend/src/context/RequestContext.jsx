import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import {
  createNewRequest,
  getAllRequests,
  runPendingEscalationSweep,
  updateRequestDecision,
  updateUserRequest,
  withdrawUserRequest,
} from "../services/requestService";

const RequestContext = createContext(null);

export const RequestProvider = ({ children }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const refreshRequests = async () => {
    setLoading(true);
    setError("");
    try {
      await runPendingEscalationSweep();
      const list = await getAllRequests();
      const scoped =
        user?.role === "admin"
          ? list
          : user?.role === "manager"
            ? list.filter((item) => item.department === user?.department)
            : list.filter((item) => item.requesterId === user?.id);
      setRequests(scoped);
      setStats({
        total: scoped.length,
        pending: scoped.filter((item) =>
          ["Pending", "Pending Manager Approval", "Pending Admin Approval"].includes(
            item.status,
          ),
        ).length,
        approved: scoped.filter((item) => item.status === "Approved").length,
        rejected: scoped.filter((item) => item.status === "Rejected").length,
      });
      setLastSyncedAt(new Date().toISOString());
    } catch (loadError) {
      setError(loadError.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setRequests([]);
      setStats({ total: 0, pending: 0, approved: 0, rejected: 0 });
      return;
    }
    refreshRequests();
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const timer = window.setInterval(() => {
      refreshRequests();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshRequests();
    };
    const onStorage = (event) => {
      if (!event.key) return;
      if (event.key.includes("smart_approval_mock_requests")) refreshRequests();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, [user]);

  const submitRequest = async (payload) => {
    setError("");
    const created = await createNewRequest(payload);
    await refreshRequests();
    return created;
  };

  const takeDecision = async (id, payload) => {
    setError("");
    await updateRequestDecision(id, payload, user?.role, user?.fullName);
    await refreshRequests();
  };

  const cancelRequest = async (id, payload = {}) => {
    setError("");
    await withdrawUserRequest(id, payload, user?.fullName);
    await refreshRequests();
  };

  const editRequest = async (id, payload = {}) => {
    setError("");
    await updateUserRequest(id, payload, user?.fullName);
    await refreshRequests();
  };

  const value = useMemo(
    () => ({
      requests,
      stats,
      loading,
      error,
      lastSyncedAt,
      refreshRequests,
      submitRequest,
      takeDecision,
      cancelRequest,
      editRequest,
    }),
    [requests, stats, loading, error, lastSyncedAt],
  );

  return (
    <RequestContext.Provider value={value}>{children}</RequestContext.Provider>
  );
};

export const useRequests = () => {
  const ctx = useContext(RequestContext);
  if (!ctx) throw new Error("useRequests must be used within RequestProvider");
  return ctx;
};
