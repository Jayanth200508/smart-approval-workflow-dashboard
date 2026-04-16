import { useEffect, useMemo, useState } from "react";
import PaginationControls from "../components/common/PaginationControls";
import { useAuth } from "../context/AuthContext";
import {
  createRequestType,
  deleteRequestType,
  listRequestTypes,
  updateRequestType,
} from "../services/workflowService";

const PAGE_SIZE = 10;

const RequestTypesPage = () => {
  const { user } = useAuth();
  const [requestTypes, setRequestTypes] = useState(listRequestTypes());
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requestTypes;
    return requestTypes.filter((item) => item.name.toLowerCase().includes(q));
  }, [requestTypes, search]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const paged = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const resetForm = () => {
    setEditingId("");
    setName("");
  };

  const onSubmit = (event) => {
    event.preventDefault();
    setError("");
    try {
      if (editingId) {
        updateRequestType(editingId, name, user);
      } else {
        createRequestType(name, user);
      }
      setRequestTypes(listRequestTypes());
      resetForm();
    } catch (submitError) {
      setError(submitError.message || "Unable to save request type.");
    }
  };

  const onEdit = (item) => {
    setEditingId(item.id);
    setName(item.name);
  };

  const onDelete = (requestTypeId) => {
    if (!window.confirm("Delete this request type?")) return;
    try {
      deleteRequestType(requestTypeId, user);
      setRequestTypes(listRequestTypes());
      if (editingId === requestTypeId) resetForm();
    } catch (submitError) {
      setError(submitError.message || "Unable to delete request type.");
    }
  };

  return (
    <section className="page-stack">
      <article className="surface-card fade-in">
        <h3>Request Types</h3>
        <form className="settings-form" onSubmit={onSubmit}>
          <label>
            <span>Request Type Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <div className="header-inline-actions">
            <button className="btn btn-primary" type="submit">
              {editingId ? "Update Request Type" : "Create Request Type"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="btn btn-outline"
                onClick={resetForm}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        <label>
          <span>Search Request Types</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by request type name"
          />
        </label>
        {error ? <div className="inline-error">{error}</div> : null}
      </article>

      <article className="surface-card fade-in">
        <div className="table-scroll">
          <table className="request-table">
            <thead>
              <tr>
                <th>Request Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length ? (
                paged.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => onEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => onDelete(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="table-empty">
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

export default RequestTypesPage;

