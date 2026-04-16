import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const statusColors = {
  Pending: "#F59E0B",
  Approved: "#10B981",
  Rejected: "#EF4444",
};

const rangeOptions = ["Last 7 Days", "Last 30 Days", "Last 6 Months"];

const daysByRange = {
  "Last 7 Days": 7,
  "Last 30 Days": 30,
  "Last 6 Months": 180,
};

const chartTooltipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 10,
  color: "#0F172A",
  fontSize: 12,
};

const AnalyticsCharts = ({ requests, stats }) => {
  const [range, setRange] = useState("Last 30 Days");

  const filteredRequests = useMemo(() => {
    const limit = new Date();
    limit.setDate(limit.getDate() - daysByRange[range]);
    return requests.filter((item) => new Date(item.submittedAt) >= limit);
  }, [requests, range]);

  const departmentData = useMemo(() => {
    const grouped = filteredRequests.reduce((acc, item) => {
      acc[item.department] = (acc[item.department] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped).map(([name, count]) => ({ name, count }));
  }, [filteredRequests]);

  const trendData = useMemo(() => {
    const grouped = filteredRequests.reduce((acc, item) => {
      const key = new Date(item.submittedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped).map(([label, value]) => ({ label, value }));
  }, [filteredRequests]);

  const statusData = [
    { name: "Pending", value: stats.pending },
    { name: "Approved", value: stats.approved },
    { name: "Rejected", value: stats.rejected },
  ];

  return (
    <section className="analytics-grid">
      <article className="surface-card fade-in">
        <div className="card-head">
          <h3>Request Volume by Department</h3>
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            aria-label="Analytics range"
          >
            {rangeOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={departmentData}>
            <CartesianGrid vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Bar dataKey="count" fill="#1E3A8A" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </article>

      <article className="surface-card fade-in">
        <h3>Status Distribution</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={statusData}
              dataKey="value"
              nameKey="name"
              outerRadius={88}
              innerRadius={54}
            >
              {statusData.map((entry) => (
                <Cell key={entry.name} fill={statusColors[entry.name]} />
              ))}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="minimal-legend">
          {statusData.map((entry) => (
            <span key={entry.name}>
              <i style={{ background: statusColors[entry.name] }} />
              {entry.name}
            </span>
          ))}
        </div>
      </article>

      <article className="surface-card fade-in span-2">
        <h3>Approval Trend</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendData}>
            <CartesianGrid vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#4F46E5"
              strokeWidth={2.8}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </article>
    </section>
  );
};

export default AnalyticsCharts;
