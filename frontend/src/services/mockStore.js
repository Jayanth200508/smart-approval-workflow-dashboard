import {
  seedActivityLogs,
  seedAnnouncements,
  seedDepartments,
  seedNotifications,
  seedRequestEvents,
  seedRequests,
  seedRequestTypes,
  seedRoles,
  seedUsers,
} from "../data/mockData";

const USERS_KEY = "smart_approval_mock_users_v2";
const REQUESTS_KEY = "smart_approval_mock_requests_v2";
const ROLES_KEY = "smart_approval_mock_roles_v2";
const DEPARTMENTS_KEY = "smart_approval_mock_departments_v2";
const REQUEST_EVENTS_KEY = "smart_approval_mock_request_events_v2";
const ACTIVITY_LOGS_KEY = "smart_approval_mock_activity_logs_v2";
const NOTIFICATIONS_KEY = "smart_approval_mock_notifications_v2";
const ANNOUNCEMENTS_KEY = "smart_approval_mock_announcements_v2";
const REQUEST_TYPES_KEY = "smart_approval_mock_request_types_v2";

const safeRead = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const safeWrite = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const enforceSingleAdmin = () => {
  const users = safeRead(USERS_KEY, seedUsers);
  const fixedAdminEmail = "jayanth.se23@bitsathy.ac.in";
  const fixedAdminPassword = "1234qwer";
  let hasFixedAdmin = false;

  const normalized = users.map((user) => {
    const email = String(user.email || "")
      .trim()
      .toLowerCase();
    if (email === fixedAdminEmail) {
      hasFixedAdmin = true;
      return {
        ...user,
        fullName: user.fullName || "Jayanth Admin",
        password: fixedAdminPassword,
        role: "admin",
        department: user.department || "Executive",
      };
    }
    return {
      ...user,
      role: user.role === "admin" ? "employee" : user.role,
    };
  });

  if (!hasFixedAdmin) {
    normalized.unshift({
      id: `u-admin-${Date.now()}`,
      fullName: "Jayanth Admin",
      email: fixedAdminEmail,
      password: fixedAdminPassword,
      role: "admin",
      department: "Executive",
    });
  }

  safeWrite(USERS_KEY, normalized);
};

const enforceEmployeeAccount = () => {
  const users = safeRead(USERS_KEY, seedUsers);
  const employeeEmail = "logesh@gmail.com";
  const employeePassword = "1234qwert";
  let hasEmployee = false;

  const normalized = users.map((user) => {
    const email = String(user.email || "").trim().toLowerCase();
    if (email === employeeEmail) {
      hasEmployee = true;
      return {
        ...user,
        fullName: user.fullName || "Logesh",
        password: employeePassword,
        role: "employee",
      };
    }
    return user;
  });

  if (!hasEmployee) {
    normalized.unshift({
      id: `u-emp-${Date.now()}`,
      fullName: "Logesh",
      email: employeeEmail,
      password: employeePassword,
      role: "employee",
      department: "Software Development",
      status: "Active",
    });
  }

  safeWrite(USERS_KEY, normalized);
};

export const initMockStore = () => {
  if (!localStorage.getItem(USERS_KEY)) {
    safeWrite(USERS_KEY, seedUsers);
  }
  if (!localStorage.getItem(REQUESTS_KEY)) {
    safeWrite(REQUESTS_KEY, seedRequests);
  }
  if (!localStorage.getItem(ROLES_KEY)) {
    safeWrite(ROLES_KEY, seedRoles);
  }
  if (!localStorage.getItem(DEPARTMENTS_KEY)) {
    safeWrite(DEPARTMENTS_KEY, seedDepartments);
  }
  if (!localStorage.getItem(REQUEST_EVENTS_KEY)) {
    safeWrite(REQUEST_EVENTS_KEY, seedRequestEvents);
  }
  if (!localStorage.getItem(ACTIVITY_LOGS_KEY)) {
    safeWrite(ACTIVITY_LOGS_KEY, seedActivityLogs);
  }
  if (!localStorage.getItem(NOTIFICATIONS_KEY)) {
    safeWrite(NOTIFICATIONS_KEY, seedNotifications);
  }
  if (!localStorage.getItem(ANNOUNCEMENTS_KEY)) {
    safeWrite(ANNOUNCEMENTS_KEY, seedAnnouncements);
  }
  if (!localStorage.getItem(REQUEST_TYPES_KEY)) {
    safeWrite(REQUEST_TYPES_KEY, seedRequestTypes);
  }
  enforceSingleAdmin();
  enforceEmployeeAccount();
};

export const getUsers = () => safeRead(USERS_KEY, seedUsers);

export const setUsers = (users) => safeWrite(USERS_KEY, users);

export const getRequests = () => safeRead(REQUESTS_KEY, seedRequests);

export const setRequests = (requests) => safeWrite(REQUESTS_KEY, requests);

export const getRoles = () => safeRead(ROLES_KEY, seedRoles);

export const setRoles = (roles) => safeWrite(ROLES_KEY, roles);

export const getDepartments = () => safeRead(DEPARTMENTS_KEY, seedDepartments);

export const setDepartments = (departments) =>
  safeWrite(DEPARTMENTS_KEY, departments);

export const getRequestEvents = () =>
  safeRead(REQUEST_EVENTS_KEY, seedRequestEvents);

export const setRequestEvents = (events) =>
  safeWrite(REQUEST_EVENTS_KEY, events);

export const getActivityLogs = () =>
  safeRead(ACTIVITY_LOGS_KEY, seedActivityLogs);

export const setActivityLogs = (logs) => safeWrite(ACTIVITY_LOGS_KEY, logs);

export const getNotifications = () =>
  safeRead(NOTIFICATIONS_KEY, seedNotifications);

export const setNotifications = (notifications) =>
  safeWrite(NOTIFICATIONS_KEY, notifications);

export const getAnnouncements = () =>
  safeRead(ANNOUNCEMENTS_KEY, seedAnnouncements);

export const setAnnouncements = (announcements) =>
  safeWrite(ANNOUNCEMENTS_KEY, announcements);

export const getRequestTypes = () =>
  safeRead(REQUEST_TYPES_KEY, seedRequestTypes);

export const setRequestTypes = (types) => safeWrite(REQUEST_TYPES_KEY, types);
