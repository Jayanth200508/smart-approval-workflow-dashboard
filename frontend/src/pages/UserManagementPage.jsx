import { useEffect, useMemo, useState } from "react";
import PaginationControls from "../components/common/PaginationControls";
import { useAuth } from "../context/AuthContext";
import {
  createUserByAdmin,
  deleteUserByAdmin,
  listDepartments,
  listUsers,
  resetUserPasswordByAdmin,
  toggleUserStatusByAdmin,
  updateUserByAdmin,
} from "../services/workflowService";

const UserManagementPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState(listUsers());
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    department: "Software Development",
    role: "employee",
  });
  const [editingUserId, setEditingUserId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const departments = listDepartments();
  const employeeCount = useMemo(
    () => users.filter((item) => item.role === "employee").length,
    [users],
  );
  const adminCount = useMemo(
    () => users.filter((item) => item.role === "admin").length,
    [users],
  );
  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((item) =>
      [item.fullName, item.email, item.department, item.role]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [users, search]);
  const totalPages = Math.max(1, Math.ceil(visibleUsers.length / PAGE_SIZE));
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visibleUsers.slice(start, start + PAGE_SIZE);
  }, [visibleUsers, page]);

  useEffect(() => {
    setPage(1);
  }, [search, users.length]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    try {
      createUserByAdmin(form, user);
      setUsers(listUsers());
      setForm({
        fullName: "",
        email: "",
        department: "Software Development",
        role: "employee",
      });
    } catch (submitError) {
      setError(submitError.message || "Unable to create user.");
    }
  };

  const startEdit = (target) => {
    setEditingUserId(target.id);
    setForm({
      fullName: target.fullName,
      email: target.email,
      department: target.department,
      role: target.role,
    });
  };

  const cancelEdit = () => {
    setEditingUserId("");
    setForm({
      fullName: "",
      email: "",
      department: "Software Development",
      role: "employee",
    });
  };

  const handleUpdate = (event) => {
    event.preventDefault();
    setError("");
    try {
      updateUserByAdmin(editingUserId, form, user);
      setUsers(listUsers());
      cancelEdit();
    } catch (submitError) {
      setError(submitError.message || "Unable to update user.");
    }
  };

  const handleToggleStatus = (targetId) => {
    try {
      toggleUserStatusByAdmin(targetId, user);
      setUsers(listUsers());
    } catch (submitError) {
      setError(submitError.message || "Unable to update status.");
    }
  };

  const handleDelete = (targetId) => {
    if (targetId === user.id) {
      setError("You cannot delete your own account.");
      return;
    }
    if (!window.confirm("Delete this user?")) return;
    try {
      deleteUserByAdmin(targetId, user);
      setUsers(listUsers());
      if (editingUserId === targetId) cancelEdit();
    } catch (submitError) {
      setError(submitError.message || "Unable to delete user.");
    }
  };

  const handleResetPassword = (targetId) => {
    const nextPassword = window.prompt(
      "Enter a new password (min 6 chars):",
      "password123",
    );
    if (!nextPassword) return;
    try {
      resetUserPasswordByAdmin(targetId, nextPassword, user);
    } catch (submitError) {
      setError(submitError.message || "Unable to reset password.");
    }
  };

  return (
    <section className="page-stack">
      <article className="surface-card fade-in">
        <div className="card-head">
          <h3>User Management</h3>
          <div className="header-inline-actions">
            <span className="status-badge status-approved">
              {employeeCount} Employees
            </span>
            <span className="status-badge status-pending">
              {adminCount} Admins
            </span>
          </div>
        </div>
        <form
          className="filters-grid"
          onSubmit={editingUserId ? handleUpdate : handleSubmit}
        >
          <label>
            <span>Full Name</span>
            <input
              value={form.fullName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, fullName: event.target.value }))
              }
              required
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              required
            />
          </label>
          <label>
            <span>Department</span>
            <select
              value={form.department}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, department: event.target.value }))
              }
            >
              {departments.map((dep) => (
                <option key={dep.id} value={dep.name}>
                  {dep.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Role</span>
            <select
              value={form.role}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, role: event.target.value }))
              }
            >
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <div className="header-inline-actions">
            <button className="btn btn-primary" type="submit">
              {editingUserId ? "Update User" : "Create User"}
            </button>
            {editingUserId ? (
              <button
                type="button"
                className="btn btn-outline"
                onClick={cancelEdit}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        <label>
          <span>Search Users</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, department, role"
          />
        </label>
        {error ? <div className="inline-error">{error}</div> : null}
      </article>

      <article className="surface-card fade-in">
        <div className="table-scroll">
          <table className="request-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Role</th>
                <th>Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length ? (
                paginatedUsers.map((item) => (
                  <tr key={item.id}>
                    <td>{item.fullName}</td>
                    <td>{item.email}</td>
                    <td>{item.department}</td>
                    <td>
                      <span
                        className={`status-badge ${item.role === "admin" ? "status-approved" : "status-pending"}`}
                      >
                        {item.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${item.status === "Inactive" ? "status-rejected" : "status-approved"}`}
                      >
                        {item.status || "Active"}
                      </span>
                    </td>
                    <td className="actions">
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm edit-btn"
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm status-btn"
                          onClick={() => handleToggleStatus(item.id)}
                        >
                          {item.status === "Inactive" ? "Activate" : "Deactivate"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm reset-btn"
                          onClick={() => handleResetPassword(item.id)}
                        >
                          Reset Password
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm delete-btn"
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </article>
    </section>
  );
};

export default UserManagementPage;
