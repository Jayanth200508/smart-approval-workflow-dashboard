import {
  getActivityLogs,
  getAnnouncements,
  getDepartments,
  getNotifications,
  getRequestTypes,
  getRequestEvents,
  getUsers,
  initMockStore,
  setActivityLogs,
  setAnnouncements,
  setDepartments,
  setNotifications,
  setRequestTypes,
  setRequestEvents,
  setUsers,
} from "./mockStore";

const descTime = (a, b) => new Date(b).getTime() - new Date(a).getTime();

export const listUsers = () => {
  initMockStore();
  return getUsers().map((item) => ({
    ...item,
    password: undefined,
  }));
};

export const createUserByAdmin = (payload, actor) => {
  initMockStore();
  const users = getUsers();
  if (
    users.some(
      (item) => item.email.toLowerCase() === payload.email.toLowerCase(),
    )
  ) {
    throw new Error("A user with this email already exists.");
  }

  const user = {
    id: `u-${Date.now()}`,
    fullName: payload.fullName.trim(),
    email: payload.email.trim().toLowerCase(),
    password: payload.password || "password123",
    role: payload.role || "employee",
    department: payload.department,
    status: "Active",
    contact: payload.contact || "",
  };
  setUsers([user, ...users]);
  addActivityLog({
    userName: actor.fullName,
    role: actor.role,
    action: "User created",
    status: user.role,
  });
  return { ...user, password: undefined };
};

export const updateUserByAdmin = (userId, updates, actor) => {
  initMockStore();
  const users = getUsers();
  const index = users.findIndex((item) => item.id === userId);
  if (index === -1) throw new Error("User not found.");

  const email = String(updates.email || users[index].email)
    .trim()
    .toLowerCase();
  const duplicate = users.find(
    (item) => item.id !== userId && item.email.toLowerCase() === email,
  );
  if (duplicate) throw new Error("Email already in use by another account.");

  const next = [...users];
  next[index] = {
    ...next[index],
    fullName: String(updates.fullName || next[index].fullName).trim(),
    email,
    department: updates.department || next[index].department,
    role: updates.role || next[index].role,
    contact: updates.contact ?? next[index].contact ?? "",
    status: updates.status || next[index].status || "Active",
  };
  setUsers(next);
  addActivityLog({
    userName: actor.fullName,
    role: actor.role,
    action: "User updated",
    status: next[index].email,
  });
  return { ...next[index], password: undefined };
};

export const toggleUserStatusByAdmin = (userId, actor) => {
  initMockStore();
  const users = getUsers();
  const index = users.findIndex((item) => item.id === userId);
  if (index === -1) throw new Error("User not found.");
  const next = [...users];
  const currentStatus = next[index].status || "Active";
  next[index] = {
    ...next[index],
    status: currentStatus === "Active" ? "Inactive" : "Active",
  };
  setUsers(next);
  addActivityLog({
    userName: actor.fullName,
    role: actor.role,
    action: "User status changed",
    status: `${next[index].email} -> ${next[index].status}`,
  });
  return { ...next[index], password: undefined };
};

export const deleteUserByAdmin = (userId, actor) => {
  initMockStore();
  const users = getUsers();
  const target = users.find((item) => item.id === userId);
  if (!target) throw new Error("User not found.");
  const next = users.filter((item) => item.id !== userId);
  setUsers(next);
  addActivityLog({
    userName: actor.fullName,
    role: actor.role,
    action: "User deleted",
    status: target.email,
  });
};

export const resetUserPasswordByAdmin = (userId, nextPassword, actor) => {
  initMockStore();
  const users = getUsers();
  const index = users.findIndex((item) => item.id === userId);
  if (index === -1) throw new Error("User not found.");
  const normalizedPassword = String(nextPassword || "").trim();
  if (normalizedPassword.length < 6)
    throw new Error("Password must be at least 6 characters.");
  const next = [...users];
  next[index] = {
    ...next[index],
    password: normalizedPassword,
  };
  setUsers(next);
  addActivityLog({
    userName: actor.fullName,
    role: actor.role,
    action: "User password reset",
    status: next[index].email,
  });
};

export const listDepartments = () => {
  initMockStore();
  return getDepartments();
};

export const createDepartment = (name, actor) => {
  initMockStore();
  const normalized = String(name || "").trim();
  if (!normalized) {
    throw new Error("Department name is required.");
  }
  const departments = getDepartments();
  if (
    departments.some(
      (dep) => dep.name.toLowerCase() === normalized.toLowerCase(),
    )
  ) {
    throw new Error("Department already exists.");
  }
  const created = { id: `dep-${Date.now()}`, name: normalized, head: "" };
  setDepartments([created, ...departments]);
  addActivityLog({
    userName: actor.fullName,
    role: actor.role,
    action: "Department updated",
    status: normalized,
  });
  return created;
};

export const updateDepartment = (departmentId, updates, actor) => {
  initMockStore();
  const departments = getDepartments();
  const index = departments.findIndex((item) => item.id === departmentId);
  if (index === -1) throw new Error("Department not found.");
  const normalizedName = String(updates.name || departments[index].name).trim();
  if (!normalizedName) throw new Error("Department name is required.");
  const duplicate = departments.find(
    (item) =>
      item.id !== departmentId &&
      item.name.toLowerCase() === normalizedName.toLowerCase(),
  );
  if (duplicate) throw new Error("Department already exists.");

  const next = [...departments];
  next[index] = {
    ...next[index],
    name: normalizedName,
    head: String(updates.head ?? next[index].head ?? "").trim(),
  };
  setDepartments(next);
  addActivityLog({
    userName: actor.fullName,
    role: actor.role,
    action: "Department updated",
    status: next[index].name,
  });
  return next[index];
};

export const deleteDepartment = (departmentId, actor) => {
  initMockStore();
  const departments = getDepartments();
  const target = departments.find((item) => item.id === departmentId);
  if (!target) throw new Error("Department not found.");
  setDepartments(departments.filter((item) => item.id !== departmentId));
  addActivityLog({
    userName: actor.fullName,
    role: actor.role,
    action: "Department deleted",
    status: target.name,
  });
};

export const listRequestTypes = () => {
  initMockStore();
  return getRequestTypes();
};

export const createRequestType = (name, actor) => {
  initMockStore();
  const normalized = String(name || "").trim();
  if (!normalized) throw new Error("Request type name is required.");
  const all = getRequestTypes();
  if (all.some((item) => item.name.toLowerCase() === normalized.toLowerCase())) {
    throw new Error("Request type already exists.");
  }
  const created = { id: `rt-${Date.now()}`, name: normalized };
  setRequestTypes([created, ...all]);
  addActivityLog({
    userName: actor.fullName,
    role: actor.role,
    action: "Request type created",
    status: normalized,
  });
  return created;
};

export const updateRequestType = (requestTypeId, name, actor) => {
  initMockStore();
  const normalized = String(name || "").trim();
  if (!normalized) throw new Error("Request type name is required.");
  const all = getRequestTypes();
  const index = all.findIndex((item) => item.id === requestTypeId);
  if (index === -1) throw new Error("Request type not found.");
  if (
    all.some(
      (item) =>
        item.id !== requestTypeId &&
        item.name.toLowerCase() === normalized.toLowerCase(),
    )
  ) {
    throw new Error("Request type already exists.");
  }
  const next = [...all];
  next[index] = { ...next[index], name: normalized };
  setRequestTypes(next);
  addActivityLog({
    userName: actor.fullName,
    role: actor.role,
    action: "Request type updated",
    status: normalized,
  });
  return next[index];
};

export const deleteRequestType = (requestTypeId, actor) => {
  initMockStore();
  const all = getRequestTypes();
  const target = all.find((item) => item.id === requestTypeId);
  if (!target) throw new Error("Request type not found.");
  setRequestTypes(all.filter((item) => item.id !== requestTypeId));
  addActivityLog({
    userName: actor.fullName,
    role: actor.role,
    action: "Request type deleted",
    status: target.name,
  });
};

export const listActivityLogs = () => {
  initMockStore();
  return [...getActivityLogs()].sort((a, b) =>
    descTime(a.timestamp, b.timestamp),
  );
};

export const addActivityLog = ({
  userName,
  role,
  action,
  requestId = "",
  status = "",
}) => {
  initMockStore();
  const logs = getActivityLogs();
  const created = {
    id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    userName,
    role,
    action,
    requestId,
    status,
  };
  setActivityLogs([created, ...logs]);
  return created;
};

export const listRequestEvents = (requestId) => {
  initMockStore();
  const events = getRequestEvents();
  return events
    .filter((entry) => entry.requestId === requestId)
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
};

export const addRequestEvent = ({
  requestId,
  action,
  actorName,
  actorRole,
  status,
  comment,
}) => {
  initMockStore();
  const events = getRequestEvents();
  const created = {
    id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    requestId,
    action,
    actorName,
    actorRole,
    status,
    comment,
    timestamp: new Date().toISOString(),
  };
  setRequestEvents([created, ...events]);
  return created;
};

export const listNotifications = (user) => {
  initMockStore();
  const all = getNotifications();
  return all
    .filter((item) => item.userId === user.id || item.userId === "all")
    .sort((a, b) => descTime(a.timestamp, b.timestamp));
};

export const listAllNotifications = () => {
  initMockStore();
  return [...getNotifications()].sort((a, b) =>
    descTime(a.timestamp, b.timestamp),
  );
};

export const addNotification = ({
  userId = "all",
  title,
  message,
  tone = "warning",
  requestId = "",
}) => {
  initMockStore();
  const notifications = getNotifications();
  const created = {
    id: `not-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId,
    title,
    message,
    tone,
    requestId,
    read: false,
    timestamp: new Date().toISOString(),
  };
  setNotifications([created, ...notifications]);
  return created;
};

export const markNotificationsRead = (user) => {
  initMockStore();
  const notifications = getNotifications().map((item) => {
    if (item.userId === user.id || item.userId === "all") {
      return { ...item, read: true };
    }
    return item;
  });
  setNotifications(notifications);
};

export const listAnnouncements = () => {
  initMockStore();
  return [...getAnnouncements()].sort((a, b) =>
    descTime(a.createdAt, b.createdAt),
  );
};

export const createAnnouncement = ({ title, message }, actor) => {
  initMockStore();
  if (!title?.trim() || !message?.trim()) {
    throw new Error("Title and message are required.");
  }
  const announcements = getAnnouncements();
  const created = {
    id: `ann-${Date.now()}`,
    title: title.trim(),
    message: message.trim(),
    createdBy: actor.fullName,
    createdAt: new Date().toISOString(),
  };
  setAnnouncements([created, ...announcements]);
  addNotification({
    userId: "all",
    title: `Announcement: ${created.title}`,
    message: created.message,
    tone: "warning",
  });
  addActivityLog({
    userName: actor.fullName,
    role: actor.role,
    action: "Announcement sent",
    status: created.title,
  });
  return created;
};

export const updateAnnouncement = (
  { announcementId, title, message },
  actor,
) => {
  initMockStore();
  const announcements = getAnnouncements();
  const index = announcements.findIndex((item) => item.id === announcementId);
  if (index === -1) throw new Error("Announcement not found.");
  if (!title?.trim() || !message?.trim())
    throw new Error("Title and message are required.");

  const next = [...announcements];
  next[index] = {
    ...next[index],
    title: title.trim(),
    message: message.trim(),
  };
  setAnnouncements(next);
  addActivityLog({
    userName: actor.fullName,
    role: actor.role,
    action: "Announcement updated",
    status: next[index].title,
  });
  return next[index];
};

export const deleteAnnouncement = (announcementId, actor) => {
  initMockStore();
  const announcements = getAnnouncements();
  const target = announcements.find((item) => item.id === announcementId);
  if (!target) throw new Error("Announcement not found.");
  setAnnouncements(announcements.filter((item) => item.id !== announcementId));
  addActivityLog({
    userName: actor.fullName,
    role: actor.role,
    action: "Announcement deleted",
    status: target.title,
  });
};
