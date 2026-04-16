import { useState } from "react";

const RequestFilters = ({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  departmentFilter = "All",
  setDepartmentFilter = () => {},
  sortBy = "Newest",
  setSortBy = () => {},
  sortOptions = [
    { value: "Newest", label: "Newest" },
    { value: "Oldest", label: "Oldest" },
    { value: "AmountHigh", label: "Amount High to Low" },
    { value: "AmountLow", label: "Amount Low to High" },
  ],
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <section className="filters-section" aria-label="Request filters">
      <button
        type="button"
        className="btn btn-outline filters-toggle"
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        {mobileOpen ? "Hide Filters" : "Show Filters"}
      </button>

      <div className={`filters-grid ${mobileOpen ? "open" : ""}`}>
        <label>
          <span>Search</span>
          <input
            type="search"
            placeholder="Search by request ID or title..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label>
          <span>Department</span>
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
          >
            <option value="All">All Departments</option>
            <option value="Software Development">Software Development</option>
            <option value="Quality Assurance">Quality Assurance</option>
            <option value="DevOps / Cloud Infrastructure">
              DevOps / Cloud Infrastructure
            </option>
            <option value="Cybersecurity">Cybersecurity</option>
            <option value="IT Support">IT Support</option>
            <option value="Human Resources">Human Resources</option>
            <option value="Finance">Finance</option>
            <option value="Project Management Office (PMO)">
              Project Management Office (PMO)
            </option>
            <option value="Client Services">Client Services</option>
            <option value="Research and Innovation">Research and Innovation</option>
          </select>
        </label>

        <label>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="All">All</option>
            <option value="Pending Manager Approval">
              Pending Manager Approval
            </option>
            <option value="Pending Admin Approval">Pending Admin Approval</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </label>

        <label>
          <span>Sort</span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
};

export default RequestFilters;
