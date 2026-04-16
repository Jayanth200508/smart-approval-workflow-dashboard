import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { simulateDigitalTwin } from "../services/intelligenceService";

const createDefaultStages = () => [
  { id: "submission_validation", label: "Submission Validation", avgHours: 3, capacityPerDay: 60, automationScore: 0.6 },
  { id: "manager_review", label: "Manager Review", avgHours: 16, capacityPerDay: 28, automationScore: 0.35 },
  { id: "admin_review", label: "Admin Review", avgHours: 14, capacityPerDay: 22, automationScore: 0.25 },
  { id: "compliance_check", label: "Compliance Check", avgHours: 8, capacityPerDay: 30, automationScore: 0.45 },
  { id: "finalization", label: "Finalization", avgHours: 4, capacityPerDay: 50, automationScore: 0.55 },
];

const WorkflowSimulatorPage = () => {
  const { user } = useAuth();
  const [stages, setStages] = useState(createDefaultStages());
  const [incomingVolumePerDay, setIncomingVolumePerDay] = useState(12);
  const [horizonDays, setHorizonDays] = useState(14);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragStageId, setDragStageId] = useState("");

  const canAccess = useMemo(
    () => ["manager", "admin"].includes(user?.role || ""),
    [user?.role],
  );

  const onDropStage = (targetId) => {
    if (!dragStageId || dragStageId === targetId) return;
    const next = [...stages];
    const dragIndex = next.findIndex((item) => item.id === dragStageId);
    const targetIndex = next.findIndex((item) => item.id === targetId);
    if (dragIndex < 0 || targetIndex < 0) return;
    const [dragged] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, dragged);
    setStages(next);
    setDragStageId("");
  };

  const updateStage = (id, key, value) => {
    setStages((prev) =>
      prev.map((stage) =>
        stage.id === id ? { ...stage, [key]: Number(value || 0) } : stage,
      ),
    );
  };

  const runSimulation = async () => {
    setLoading(true);
    try {
      const payload = await simulateDigitalTwin({
        incomingVolumePerDay,
        horizonDays,
        stageMap: stages,
      });
      setResult(payload);
    } finally {
      setLoading(false);
    }
  };

  if (!canAccess) {
    return (
      <section className="page-stack">
        <article className="surface-card fade-in">
          <h3>Workflow Simulator Access Required</h3>
          <p>This page is restricted to manager/admin accounts.</p>
        </article>
      </section>
    );
  }

  return (
    <section className="page-stack">
      <motion.article
        className="surface-card workflow-simulator-head"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <p className="prediction-eyebrow">Workflow Simulation / Digital Twin</p>
          <h3>Scenario Lab</h3>
          <p className="muted-line">
            Drag stages to model alternate process flows and predict capacity bottlenecks.
          </p>
        </div>
        <div className="workflow-sim-controls">
          <label>
            <span>Incoming / day</span>
            <input
              type="number"
              min="1"
              value={incomingVolumePerDay}
              onChange={(event) => setIncomingVolumePerDay(Number(event.target.value || 1))}
            />
          </label>
          <label>
            <span>Horizon (days)</span>
            <input
              type="number"
              min="1"
              max="60"
              value={horizonDays}
              onChange={(event) => setHorizonDays(Number(event.target.value || 1))}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={runSimulation}
            disabled={loading}
          >
            {loading ? "Simulating..." : "Run Digital Twin"}
          </button>
        </div>
      </motion.article>

      <article className="surface-card">
        <h3>Stage Map (Drag to Reorder)</h3>
        <div className="stage-map-grid">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="stage-map-card"
              draggable
              onDragStart={() => setDragStageId(stage.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onDropStage(stage.id)}
            >
              <strong>{stage.label}</strong>
              <label>
                <span>Avg Hours</span>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={stage.avgHours}
                  onChange={(event) => updateStage(stage.id, "avgHours", event.target.value)}
                />
              </label>
              <label>
                <span>Capacity / Day</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={stage.capacityPerDay}
                  onChange={(event) =>
                    updateStage(stage.id, "capacityPerDay", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Automation Score</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={stage.automationScore}
                  onChange={(event) =>
                    updateStage(stage.id, "automationScore", event.target.value)
                  }
                />
              </label>
            </div>
          ))}
        </div>
      </article>

      {result ? (
        <>
          <article className="surface-card">
            <h3>Simulation Output</h3>
            <div className="metrics-grid">
              <div className="surface-card subtle-highlight">
                <span className="muted-line">Average Approval Time</span>
                <h3>{Number(result.averageApprovalHours || 0).toFixed(2)}h</h3>
              </div>
              <div className="surface-card subtle-highlight">
                <span className="muted-line">Predicted Bottleneck</span>
                <h3>{result.predictedBottleneckStage || "N/A"}</h3>
              </div>
              <div className="surface-card subtle-highlight">
                <span className="muted-line">Queue Load Risk</span>
                <h3>{(Number(result.queueLoadRisk || 0) * 100).toFixed(1)}%</h3>
              </div>
            </div>
          </article>

          <article className="surface-card">
            <h3>Stage Breakdown</h3>
            <div className="workflow-ops-list">
              {(result.stageBreakdown || []).map((stage) => (
                <div key={stage.stageId} className="workflow-ops-item">
                  <div>
                    <strong>{stage.stageLabel}</strong>
                    <p>
                      Utilization {(Number(stage.utilization || 0) * 100).toFixed(1)}% | Queue delay {Number(stage.queueDelayHours || 0).toFixed(1)}h
                    </p>
                  </div>
                  <span>{Number(stage.stageTimeHours || 0).toFixed(1)}h</span>
                </div>
              ))}
            </div>
            {(result.recommendations || []).length ? (
              <div className="prediction-alert-list">
                {result.recommendations.map((rec) => (
                  <p key={rec}>{rec}</p>
                ))}
              </div>
            ) : null}
          </article>
        </>
      ) : null}
    </section>
  );
};

export default WorkflowSimulatorPage;