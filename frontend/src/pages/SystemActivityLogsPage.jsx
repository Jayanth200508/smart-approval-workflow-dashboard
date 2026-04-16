import { useEffect, useMemo, useState } from "react";
import PaginationControls from "../components/common/PaginationControls";
import { listActivityLogs } from "../services/workflowService";

const SystemActivityLogsPage = () => {
  const PAGE_SIZE = 12;
  const logs = listActivityLogs();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return logs.slice(start, start + PAGE_SIZE);
  }, [logs, page]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <section className="page-stack">
      <article className="surface-card fade-in">
        <h3>System Activity Log</h3>
        <div className="table-scroll">
          <table className="request-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Request ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.timestamp).toLocaleString()}</td>
                  <td>{item.userName}</td>
                  <td>{item.role}</td>
                  <td>{item.action}</td>
                  <td>{item.requestId || "-"}</td>
                  <td>{item.status || "-"}</td>
                </tr>
              ))}
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

export default SystemActivityLogsPage;
