import { useEffect, useMemo, useState } from "react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { useRequests } from "../context/RequestContext";
import {
  exportProcessDnaPdf,
  getAdaptiveWidgetOrder,
  getIntelligenceSnapshot,
  simulateWorkflow,
  trackWidgetUsage,
} from "../services/intelligenceService";

const tooltipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: 12,
  color: "#1E293B",
  fontSize: 12,
};

const riskColors = {
  Low: "#10B981",
  Medium: "#F59E0B",
  High: "#EF4444",
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const stageLabels = {
  submissionToManager: "Submit -> Manager",
  managerToAdmin: "Manager -> Admin",
  adminToDecision: "Admin -> Decision",
  endToEnd: "End-to-End",
};

const widgetIds = [
  "friction",
  "decision",
  "risk",
  "simulation",
  "escalation",
  "load",
  "fairness",
  "process-dna",
];

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const IntelligenceHubPage = () => {
  const { user } = useAuth();
  const { requests, loading } = useRequests();
  const [snapshot, setSnapshot] = useState(null);
  const [simParams, setSimParams] = useState({
    department: "Operations",
    amount: 10000,
    priority: "medium",
  });
  const [simulation, setSimulation] = useState(null);
  const [orderedWidgets, setOrderedWidgets] = useState(widgetIds);
  const [selectedDepartment, setSelectedDepartment] = useState("");

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      const data = await getIntelligenceSnapshot(requests);
      if (!isMounted) return;
      setSnapshot(data);
      setOrderedWidgets(getAdaptiveWidgetOrder(widgetIds));
      setSelectedDepartment(data?.processDna?.[0]?.department || "Operations");
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [requests]);

  const handleSimulate = async (event) => {
    event.preventDefault();
    const result = await simulateWorkflow(simParams, requests);
    setSimulation(result);
  };

  const topApprovers = useMemo(
    () =>
      (snapshot?.decisionPatterns?.approverTrends || [])
        .slice(0, 2)
        .map((item) => item.approver),
    [snapshot],
  );

  const activeProcessDna = useMemo(
    () =>
      (snapshot?.processDna || []).find(
        (item) => item.department === selectedDepartment,
      ),
    [snapshot, selectedDepartment],
  );

  const markWidget = (id) => {
    trackWidgetUsage(id);
  };

  if (!["manager", "admin"].includes(user?.role || "")) {
    return (
      <section className="page-stack">
        <article className="surface-card fade-in">
          <h3>Intelligence Hub Access Required</h3>
          <p>
            This area is restricted to manager and admin roles for diagnostics
            and predictive workflow governance.
          </p>
        </article>
      </section>
    );
  }

  if (loading || !snapshot) {
    return (
      <section className="page-stack">
        <div className="skeleton-grid">
          <div className="skeleton-item" />
          <div className="skeleton-item" />
          <div className="skeleton-item short" />
          <div className="skeleton-item short" />
        </div>
      </section>
    );
  }

  return (
    <section className="page-stack">
      <article className="surface-card smartpulse-card fade-in">
        <div>
          <p className="smartpulse-eyebrow">SmartPulse Engine</p>
          <h3>Central Workflow Intelligence Monitor</h3>
          <p>
            Delay Probability:{" "}
            <strong>
              {Math.round(snapshot.smartPulse.delayProbability * 100)}%
            </strong>{" "}
            | Health Score: <strong>{snapshot.smartPulse.healthScore}</strong>
          </p>
        </div>
        <ul className="smartpulse-list">
          {snapshot.smartPulse.suggestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <div className="intelligence-grid">
        {orderedWidgets.map((id) => {
          if (id === "friction") {
            const values = snapshot.friction.frictionHeatmap.flatMap((item) => [
              item.submissionToManager,
              item.managerToAdmin,
              item.adminToDecision,
              item.endToEnd,
            ]);
            const maxValue = Math.max(...values, 1);
            return (
              <article
                key={id}
                className="surface-card intelligence-widget span-2"
                onMouseEnter={() => markWidget(id)}
              >
                <h3>Workflow Friction Intelligence Engine</h3>
                <div className="heatmap-grid">
                  <div className="heatmap-row heatmap-head">
                    <span>Department</span>
                    {Object.values(stageLabels).map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                  {snapshot.friction.frictionHeatmap.map((row) => (
                    <div key={row.department} className="heatmap-row">
                      <span>{row.department}</span>
                      {Object.keys(stageLabels).map((stage) => {
                        const intensity = clamp(
                          (row[stage] || 0) / maxValue,
                          0,
                          1,
                        );
                        return (
                          <span
                            key={`${row.department}-${stage}`}
                            className="heatmap-cell"
                            style={{
                              backgroundColor: `rgba(37, 99, 235, ${0.08 + intensity * 0.72})`,
                            }}
                            title={`${row.department} - ${stageLabels[stage]}: ${row[stage] || 0}h`}
                          >
                            {(row[stage] || 0).toFixed(1)}h
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <p className="muted-line">
                  Workflow Health Score: {snapshot.friction.workflowHealthScore}
                </p>
              </article>
            );
          }

          if (id === "decision") {
            return (
              <article
                key={id}
                className="surface-card intelligence-widget"
                onMouseEnter={() => markWidget(id)}
              >
                <h3>Decision Pattern Analyzer</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={snapshot.decisionPatterns.behaviorTrend}>
                    <CartesianGrid vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "#64748B", fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    {topApprovers.map((approver, index) => (
                      <Line
                        key={approver}
                        type="monotone"
                        dataKey={`${approver}_approved`}
                        name={`${approver} approvals`}
                        stroke={index === 0 ? "#2563EB" : "#0EA5E9"}
                        strokeWidth={2.4}
                        dot={false}
                        animationDuration={900}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <div className="approver-bias-list">
                  {snapshot.decisionPatterns.approverTrends
                    .slice(0, 4)
                    .map((item) => (
                      <div key={item.approver}>
                        <strong>{item.approver}</strong>
                        <span>Bias: {item.biasIndicator}%</span>
                      </div>
                    ))}
                </div>
              </article>
            );
          }

          if (id === "risk") {
            return (
              <article
                key={id}
                className="surface-card intelligence-widget"
                onMouseEnter={() => markWidget(id)}
              >
                <h3>Approval Risk Score System</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={snapshot.risk.riskDistribution}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={80}
                      innerRadius={48}
                      animationDuration={900}
                    >
                      {snapshot.risk.riskDistribution.map((item) => (
                        <Cell key={item.name} fill={riskColors[item.name]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="risk-list">
                  {snapshot.risk.requestRisk.slice(0, 4).map((item) => (
                    <div key={item.requestId}>
                      <span>{item.title}</span>
                      <span
                        className={`risk-badge risk-${item.riskLevel.toLowerCase()}`}
                      >
                        {item.riskLevel}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            );
          }

          if (id === "simulation") {
            return (
              <article
                key={id}
                className="surface-card intelligence-widget"
                onMouseEnter={() => markWidget(id)}
              >
                <h3>Workflow Simulation Mode</h3>
                <form className="simulation-form" onSubmit={handleSimulate}>
                  <label>
                    <span>Department</span>
                    <input
                      value={simParams.department}
                      onChange={(event) =>
                        setSimParams((prev) => ({
                          ...prev,
                          department: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>Amount</span>
                    <input
                      type="number"
                      min="0"
                      value={simParams.amount}
                      onChange={(event) =>
                        setSimParams((prev) => ({
                          ...prev,
                          amount: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>Priority</span>
                    <select
                      value={simParams.priority}
                      onChange={(event) =>
                        setSimParams((prev) => ({
                          ...prev,
                          priority: event.target.value,
                        }))
                      }
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                  <button type="submit" className="btn btn-primary">
                    Run Simulation
                  </button>
                </form>
                {simulation ? (
                  <div className="simulation-result">
                    <p>
                      Estimated Duration: {simulation.estimatedApprovalHours}h
                    </p>
                    <p>
                      Predicted Bottleneck: {simulation.predictedBottleneck}
                    </p>
                    <p>
                      Delay Probability:{" "}
                      {Math.round(simulation.delayProbability * 100)}%
                    </p>
                  </div>
                ) : null}
              </article>
            );
          }

          if (id === "escalation") {
            return (
              <article
                key={id}
                className="surface-card intelligence-widget"
                onMouseEnter={() => markWidget(id)}
              >
                <h3>Smart Escalation Intelligence</h3>
                <div className="escalation-list">
                  {snapshot.smartEscalation.length ? (
                    snapshot.smartEscalation.map((item) => (
                      <div key={item.approver}>
                        <strong>{item.approver}</strong>
                        <span>{item.avgReviewHours}h avg</span>
                        <span>{item.approvalRate}% approval</span>
                      </div>
                    ))
                  ) : (
                    <p className="muted-line">
                      No historical approval actions available yet.
                    </p>
                  )}
                </div>
              </article>
            );
          }

          if (id === "load") {
            return (
              <article
                key={id}
                className="surface-card intelligence-widget"
                onMouseEnter={() => markWidget(id)}
              >
                <h3>Organizational Load Meter</h3>
                <div className="load-meter-track">
                  <span style={{ width: `${snapshot.load.loadPercent}%` }} />
                </div>
                <p className="muted-line">
                  {snapshot.load.currentLoad}/{snapshot.load.capacity} active
                  queue load ({snapshot.load.loadPercent}%)
                </p>
                {snapshot.load.overload ? (
                  <p className="load-warning">Overload risk detected.</p>
                ) : null}
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={snapshot.load.trafficTrend}>
                    <CartesianGrid vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="date" hide />
                    <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="volume"
                      stroke="#2563EB"
                      fill="rgba(37, 99, 235, 0.18)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </article>
            );
          }

          if (id === "fairness") {
            return (
              <article
                key={id}
                className="surface-card intelligence-widget"
                onMouseEnter={() => markWidget(id)}
              >
                <h3>Performance Fairness Index</h3>
                <p className="fairness-score">
                  {snapshot.fairness.fairnessScore}
                </p>
                <p className="muted-line">
                  Higher score indicates better workload balance among
                  reviewers.
                </p>
                <div className="fairness-list">
                  {snapshot.fairness.loads.map((item) => (
                    <div key={item.manager}>
                      <span>{item.manager}</span>
                      <strong>{item.handled} handled</strong>
                    </div>
                  ))}
                </div>
              </article>
            );
          }

          return (
            <article
              key={id}
              className="surface-card intelligence-widget span-2"
              onMouseEnter={() => markWidget(id)}
            >
              <h3>Process DNA Report Generator</h3>
              <div className="process-dna-controls">
                <select
                  value={selectedDepartment}
                  onChange={(event) =>
                    setSelectedDepartment(event.target.value)
                  }
                >
                  {snapshot.processDna.map((item) => (
                    <option key={item.department} value={item.department}>
                      {item.department}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={async () => {
                    if (!activeProcessDna) return;
                    const blob = await exportProcessDnaPdf(
                      selectedDepartment,
                      activeProcessDna,
                    );
                    downloadBlob(
                      blob,
                      `process-dna-${selectedDepartment.toLowerCase()}.pdf`,
                    );
                  }}
                >
                  Export PDF
                </button>
              </div>
              {activeProcessDna ? (
                <div className="process-dna-grid">
                  <div>
                    <span>Delay Factor</span>
                    <strong>{activeProcessDna.delayFactor}h</strong>
                  </div>
                  <div>
                    <span>Risk Ratio</span>
                    <strong>{activeProcessDna.riskRatio}%</strong>
                  </div>
                  <div>
                    <span>Efficiency Score</span>
                    <strong>{activeProcessDna.efficiencyScore}</strong>
                  </div>
                  <div>
                    <span>Bottleneck Summary</span>
                    <strong>{activeProcessDna.bottleneckSummary}</strong>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default IntelligenceHubPage;
