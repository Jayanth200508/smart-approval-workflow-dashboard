import { useEffect, useMemo, useState } from "react";
import PaginationControls from "../components/common/PaginationControls";
import { useAuth } from "../context/AuthContext";
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  listUsers,
  updateDepartment,
} from "../services/workflowService";

const DepartmentManagementPage = () => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState(listDepartments());
  const [name, setName] = useState("");
  const [head, setHead] = useState("");
  const [error, setError] = useState("");
  const [editingDepartmentId, setEditingDepartmentId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    try {
      createDepartment(name, user);
      setDepartments(listDepartments());
      setName("");
      setHead("");
    } catch (submitError) {
      setError(submitError.message || "Unable to create department.");
    }
  };

  const handleUpdate = (event) => {
    event.preventDefault();
    setError("");
    try {
      updateDepartment(editingDepartmentId, { name, head }, user);
      setDepartments(listDepartments());
      setEditingDepartmentId("");
      setName("");
      setHead("");
    } catch (submitError) {
      setError(submitError.message || "Unable to update department.");
    }
  };

  const beginEdit = (department) => {
    setEditingDepartmentId(department.id);
    setName(department.name);
    setHead(department.head || "");
  };

  const handleDelete = (departmentId) => {
    if (!window.confirm("Delete this department?")) return;
    try {
      deleteDepartment(departmentId, user);
      setDepartments(listDepartments());
      if (editingDepartmentId === departmentId) {
        setEditingDepartmentId("");
        setName("");
        setHead("");
      }
    } catch (submitError) {
      setError(submitError.message || "Unable to delete department.");
    }
  };

  const userCountByDepartment = useMemo(() => {
    const users = listUsers();
    return users.reduce((acc, item) => {
      const key = item.department || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [departments]);

  const visibleDepartments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((item) =>
      [item.name, item.head || ""].join(" ").toLowerCase().includes(q),
    );
  }, [departments, search]);
  const totalPages = Math.max(
    1,
    Math.ceil(visibleDepartments.length / PAGE_SIZE),
  );
  const paginatedDepartments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visibleDepartments.slice(start, start + PAGE_SIZE);
  }, [visibleDepartments, page]);

  useEffect(() => {
    setPage(1);
  }, [search, departments.length]);

  return (
    <section className="page-stack">
      <article className="surface-card fade-in">
        <h3>Department Management</h3>
        <form
          className="filters-grid"
          onSubmit={editingDepartmentId ? handleUpdate : handleSubmit}
        >
          <label>
            <span>Department Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Department Head</span>
            <input
              value={head}
              onChange={(event) => setHead(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <div />
          <div className="header-inline-actions">
            <button type="submit" className="btn btn-primary">
              {editingDepartmentId ? "Update Department" : "Add Department"}
            </button>
            {editingDepartmentId ? (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setEditingDepartmentId("");
                  setName("");
                  setHead("");
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        <label>
          <span>Search Departments</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by department or head"
          />
        </label>
        {error ? <div className="inline-error">{error}</div> : null}
      </article>

      <article className="surface-card fade-in">
        <div className="table-scroll">
          <table className="request-table">
            <thead>
              <tr>
                <th>Department Name</th>
                <th>Department Head</th>
                <th>Total Users</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDepartments.length ? (
                paginatedDepartments.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.head || "-"}</td>
                    <td>{userCountByDepartment[item.name] || 0}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => beginEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
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
                  <td colSpan={4} className="table-empty">
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

export default DepartmentManagementPage;
