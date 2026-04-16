import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import {
  addNotification as addNotificationRecord,
  listNotifications,
  markNotificationsRead,
} from "../services/workflowService";

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const seenRef = useRef(new Set());

  const pushToast = ({ title, message, tone = "success" }) => {
    const id = `toast-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setToasts((prev) => [...prev, { id, title, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3200);
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setToasts([]);
      seenRef.current = new Set();
      return;
    }
    const rows = listNotifications(user);
    setNotifications(rows);
    seenRef.current = new Set(rows.map((item) => item.id));
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const timer = window.setInterval(() => {
      setNotifications(listNotifications(user));
    }, 30000);
    return () => window.clearInterval(timer);
  }, [user]);

  const addNotification = ({
    title,
    message,
    tone = "success",
    requestId = "",
  }) => {
    if (!user) return;
    addNotificationRecord({
      userId: user.id,
      title,
      message,
      tone,
      requestId,
    });
    const rows = listNotifications(user);
    setNotifications(rows);
    pushToast({ title, message, tone });
  };

  const markAllAsRead = () => {
    if (!user) return;
    markNotificationsRead(user);
    setNotifications(listNotifications(user));
  };

  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    if (!user) return;
    const nextIds = new Set();
    notifications.forEach((item) => {
      nextIds.add(item.id);
      if (!seenRef.current.has(item.id) && !item.read) {
        pushToast({
          title: item.title,
          message: item.message,
          tone: item.tone || "warning",
        });
      }
    });
    seenRef.current = nextIds;
  }, [notifications, user]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      toasts,
      addNotification,
      markAllAsRead,
      dismissToast: (id) =>
        setToasts((prev) => prev.filter((item) => item.id !== id)),
    }),
    [notifications, unreadCount, toasts],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
  return ctx;
};
