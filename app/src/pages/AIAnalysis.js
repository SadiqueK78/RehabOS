import React from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import "./AIAnalysis.css";

const progressData = [
  { session: "Day 1", accuracy: 65 },
  { session: "Day 2", accuracy: 72 },
  { session: "Day 3", accuracy: 78 },
  { session: "Day 4", accuracy: 85 },
  { session: "Day 5", accuracy: 91 },
];

const errorDistribution = [
  { name: "Correct Form", value: 68 },
  { name: "Minor Errors", value: 20 },
  { name: "Major Errors", value: 12 },
];

const exercisePerformance = [
  { exercise: "Squat", score: 88 },
  { exercise: "Push Up", score: 76 },
  { exercise: "Plank", score: 82 },
  { exercise: "Shoulder Rolls", score: 91 },
];

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444"];

function AIAnalysis() {
  return (
    <div className="ai-root">
      <h1>AI Exercise Analysis</h1>
      <p className="subtitle">
        AI-driven insights into posture accuracy, form quality, and progress.
      </p>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <h4>Overall Accuracy</h4>
          <h2>89%</h2>
          <span className="chip success">Improving</span>
        </div>
        <div className="kpi-card">
          <h4>Avg Reps / Session</h4>
          <h2>42</h2>
          <span className="chip info">Consistent</span>
        </div>
        <div className="kpi-card">
          <h4>Risk Level</h4>
          <h2>Low</h2>
          <span className="chip success">Safe Training</span>
        </div>
      </div>

      {/* Charts */}
      <div className="chart-grid">
        <div className="chart-card">
          <h3>Form Accuracy Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={progressData}>
              <XAxis dataKey="session" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="#6366f1"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Form Quality Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={errorDistribution}
                dataKey="value"
                nameKey="name"
                outerRadius={110}
                label
              >
                {errorDistribution.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card wide">
          <h3>Exercise-wise Performance</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={exercisePerformance}>
              <XAxis dataKey="exercise" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="score" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default AIAnalysis;
