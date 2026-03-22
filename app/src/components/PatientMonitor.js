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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import content from "../assets/content.json";
import "../pages/AIAnalysis.css";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function PatientMonitor({ patientName, patientEmail, exerciseHistory, rehabPlan, liveSessions: liveSessionsRaw }) {
  // Build history array from exerciseHistory object
  const history = Object.entries(exerciseHistory || {})
    .map(([ts, data]) => ({ timestamp: parseInt(ts), ...data }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Build live sessions array
  const liveSessions = Object.entries(liveSessionsRaw || {})
    .map(([ts, data]) => ({ timestamp: parseInt(ts), ...data }))
    .sort((a, b) => b.timestamp - a.timestamp);
  const totalLiveSessions = liveSessions.length;
  const totalLiveExercises = liveSessions.reduce((s, ls) => s + (ls.exercisesPerformed?.length || 0), 0);
  const totalLiveDuration = liveSessions.reduce((s, ls) => s + (ls.duration || 0), 0);

  const totalSessions = history.length;
  const totalReps = history.reduce((sum, h) => sum + (h.repCount || 0), 0);
  const totalDuration = history.reduce((sum, h) => sum + (h.duration || 0), 0);
  const avgReps = totalSessions > 0 ? Math.round(totalReps / totalSessions) : 0;
  const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;

  const repsOverTime = history.map((h) => ({
    session: new Date(h.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    reps: h.repCount || 0,
  }));

  const exerciseCounts = {};
  history.forEach((h) => {
    const name = h.exercise || "Unknown";
    exerciseCounts[name] = (exerciseCounts[name] || 0) + 1;
  });
  const exerciseDistribution = Object.entries(exerciseCounts).map(([name, value]) => ({ name, value }));

  const exerciseRepsMap = {};
  history.forEach((h) => {
    const name = h.exercise || "Unknown";
    if (!exerciseRepsMap[name]) exerciseRepsMap[name] = { total: 0, count: 0 };
    exerciseRepsMap[name].total += h.repCount || 0;
    exerciseRepsMap[name].count += 1;
  });
  const exercisePerformance = Object.entries(exerciseRepsMap).map(([exercise, d]) => ({
    exercise,
    avgReps: Math.round(d.total / d.count),
  }));

  // Rehab plan analytics
  const isPlanApproved = rehabPlan && rehabPlan.status === "approved";
  const isPlanPending = rehabPlan && rehabPlan.status === "pending";
  const rehabExerciseIds = isPlanApproved ? rehabPlan.exercises || [] : [];
  const rehabExerciseDetails = isPlanApproved ? rehabPlan.exerciseDetails || [] : [];

  const toDisplayName = (id) => id.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());

  const matchesExercise = (histEntry, exId) => {
    const displayName = toDisplayName(exId);
    return histEntry.exercise === displayName || histEntry.exercise === exId;
  };

  const rehabHistory = isPlanApproved
    ? history.filter((h) => rehabExerciseIds.some((id) => matchesExercise(h, id)))
    : [];

  const rehabSessions = rehabHistory.length;
  const rehabTotalReps = rehabHistory.reduce((sum, h) => sum + (h.repCount || 0), 0);

  const rehabRepsOverTime = rehabHistory.map((h) => ({
    session: new Date(h.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    reps: h.repCount || 0,
  }));

  const rehabExerciseCounts = {};
  rehabHistory.forEach((h) => {
    const name = h.exercise || "Unknown";
    rehabExerciseCounts[name] = (rehabExerciseCounts[name] || 0) + 1;
  });
  const rehabExerciseDistribution = Object.entries(rehabExerciseCounts).map(([name, value]) => ({ name, value }));

  const exercisesWithSessions = new Set(rehabHistory.map((h) => h.exercise));
  const rehabCompletionPercent = rehabExerciseIds.length > 0
    ? Math.round((exercisesWithSessions.size / rehabExerciseIds.length) * 100)
    : 0;

  const perExerciseProgress = rehabExerciseIds.map((exId) => {
    const detail = rehabExerciseDetails.find((d) => d.id === exId) || {};
    const sessions = history.filter((h) => matchesExercise(h, exId));
    const sessCount = sessions.length;
    const totalRepsEx = sessions.reduce((s, h) => s + (h.repCount || 0), 0);
    const totalDurEx = sessions.reduce((s, h) => s + (h.duration || 0), 0);
    const avgRepsEx = sessCount > 0 ? Math.round(totalRepsEx / sessCount) : 0;
    const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
    const targetReps = (detail.reps || 10) * (detail.sets || 3);
    const progressPercent = sessCount > 0 ? Math.min(100, Math.round((avgRepsEx / targetReps) * 100)) : 0;

    return {
      id: exId,
      name: detail.name || toDisplayName(exId),
      description: content.catalog?.[exId] || "",
      reps: detail.reps || 10,
      sets: detail.sets || 3,
      holdSeconds: detail.holdSeconds || 0,
      frequencyPerWeek: detail.frequencyPerWeek || 3,
      difficulty: detail.difficulty || "beginner",
      muscleGroup: detail.muscleGroup || "General",
      sessionsCompleted: sessCount,
      totalReps: totalRepsEx,
      totalDuration: totalDurEx,
      avgReps: avgRepsEx,
      targetReps,
      progressPercent,
      lastSessionDate: lastSession ? new Date(lastSession.timestamp).toLocaleDateString() : null,
    };
  });

  const weeklyConsistency = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
    const count = rehabHistory.filter((h) => new Date(h.timestamp).getDay() === ((i + 1) % 7)).length;
    return { day, sessions: count };
  });

  const improvementTrend = rehabHistory.map((h, i, arr) => {
    const w = arr.slice(Math.max(0, i - 2), i + 1);
    const avg = Math.round(w.reduce((s, x) => s + (x.repCount || 0), 0) / w.length);
    return {
      session: new Date(h.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      reps: h.repCount || 0,
      trend: avg,
    };
  });

  const radarData = perExerciseProgress.map((ex) => ({
    exercise: ex.name.length > 12 ? ex.name.substring(0, 12) + "..." : ex.name,
    progress: ex.progressPercent,
    fullMark: 100,
  }));

  const weeklySchedule = rehabPlan?.weeklySchedule || [];

  // Recovery Score
  const toDateStr = (ts) => new Date(ts).toISOString().split("T")[0];
  const sessionDates = new Set(history.map((h) => toDateStr(h.timestamp)));
  let streak = 0;
  const today = new Date();
  for (let d = 0; d < 365; d++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - d);
    if (sessionDates.has(toDateStr(checkDate.getTime()))) {
      streak++;
    } else if (d > 0) {
      break;
    }
  }

  const planAgeWeeks = rehabPlan?.createdAt
    ? Math.max(1, Math.ceil((Date.now() - rehabPlan.createdAt) / (7 * 24 * 60 * 60 * 1000)))
    : 1;
  const totalExpectedFrequency = rehabExerciseDetails.reduce((s, d) => s + (d.frequencyPerWeek || 3), 0);
  const expectedSessions = totalExpectedFrequency * planAgeWeeks;
  const sessionScore = isPlanApproved
    ? Math.min(30, Math.round((rehabSessions / Math.max(1, expectedSessions)) * 30))
    : Math.min(30, Math.round((totalSessions / Math.max(1, totalSessions + 5)) * 30));

  const coverageScore = isPlanApproved
    ? Math.round((exercisesWithSessions.size / Math.max(1, rehabExerciseIds.length)) * 20)
    : Math.min(20, Object.keys(exerciseCounts).length * 4);

  const last7 = new Set();
  for (let d = 0; d < 7; d++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - d);
    if (sessionDates.has(toDateStr(checkDate.getTime()))) last7.add(d);
  }
  const consistencyScore = Math.round((last7.size / 7) * 25);

  const dataSource = isPlanApproved && rehabHistory.length >= 2 ? rehabHistory : history;
  let improvementScore = 12;
  if (dataSource.length >= 4) {
    const mid = Math.floor(dataSource.length / 2);
    const firstHalf = dataSource.slice(0, mid);
    const secondHalf = dataSource.slice(mid);
    const avgFirst = firstHalf.reduce((s, h) => s + (h.repCount || 0), 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, h) => s + (h.repCount || 0), 0) / secondHalf.length;
    if (avgFirst > 0) {
      const pctChange = ((avgSecond - avgFirst) / avgFirst) * 100;
      improvementScore = Math.max(0, Math.min(25, Math.round(((pctChange + 50) / 100) * 25)));
    }
  }

  const recoveryScore = Math.min(100, sessionScore + coverageScore + consistencyScore + improvementScore);

  const scoreBreakdown = [
    { label: "Sessions", score: sessionScore, max: 30, icon: "📋" },
    { label: "Coverage", score: coverageScore, max: 20, icon: "🎯" },
    { label: "Consistency", score: consistencyScore, max: 25, icon: "📅" },
    { label: "Improvement", score: improvementScore, max: 25, icon: "📈" },
  ];

  const scoreInsights = [];
  if (consistencyScore >= 18) scoreInsights.push({ text: "Great consistency this week!", type: "positive" });
  else if (consistencyScore <= 7) scoreInsights.push({ text: "Needs more regular exercise", type: "warning" });
  if (improvementScore >= 18) scoreInsights.push({ text: "Strong improvement trend", type: "positive" });
  else if (improvementScore <= 7) scoreInsights.push({ text: "Reps declining — may need attention", type: "warning" });
  if (coverageScore >= 16) scoreInsights.push({ text: "Excellent exercise variety", type: "positive" });
  else if (coverageScore <= 5) scoreInsights.push({ text: "Low exercise coverage", type: "warning" });
  if (sessionScore >= 22) scoreInsights.push({ text: "Session targets on track", type: "positive" });
  else if (sessionScore <= 8) scoreInsights.push({ text: "More sessions needed", type: "warning" });
  if (streak >= 7) scoreInsights.push({ text: `Amazing ${streak}-day streak!`, type: "positive" });
  else if (streak >= 3) scoreInsights.push({ text: `${streak}-day streak`, type: "positive" });

  const scoreColor = recoveryScore >= 75 ? "#22c55e" : recoveryScore >= 50 ? "#f59e0b" : "#ef4444";
  const circumference = 339.3;
  const scoreDash = (recoveryScore / 100) * circumference;

  if (totalSessions === 0) {
    return (
      <div className="ai-root">
        <h1>{patientName}'s Exercise Analysis</h1>
        <p className="subtitle">
          This patient has no exercise data yet.
        </p>
      </div>
    );
  }

  return (
    <div className="ai-root">
      <h1>{patientName}'s Exercise Analysis</h1>
      <p className="subtitle">
        Monitoring {totalSessions} recorded session{totalSessions !== 1 ? "s" : ""} for {patientEmail}
      </p>

      {/* Rehab Plan Status Banner */}
      {isPlanPending && (
        <div className="rehab-banner" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div className="rehab-banner-header">
            <h3>Rehabilitation Plan Under Review</h3>
            <span className="rehab-status-badge" style={{ background: "#f59e0b" }}>Pending</span>
          </div>
          <p>This patient's plan is awaiting your review. Rehab analytics will appear once approved.</p>
        </div>
      )}
      {isPlanApproved && (
        <div className="rehab-banner">
          <div className="rehab-banner-header">
            <h3>Active Rehabilitation Plan</h3>
            <span className="rehab-status-badge">Approved</span>
          </div>
          <p>
            Targeting: <strong>{rehabPlan.matchedConditions?.join(", ")}</strong> |{" "}
            {rehabExerciseIds.length} exercise{rehabExerciseIds.length !== 1 ? "s" : ""} |{" "}
            Coverage: <strong>{rehabCompletionPercent}%</strong>
            {rehabPlan.reviewedBy && (
              <> | Approved by: <strong>{rehabPlan.reviewedBy}</strong></>
            )}
          </p>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${rehabCompletionPercent}%` }} />
          </div>
          {rehabPlan.therapistNotes && (
            <div style={{
              marginTop: "0.75rem",
              padding: "0.75rem 1rem",
              background: "rgba(99,102,241,0.08)",
              borderRadius: "8px",
              borderLeft: "3px solid #6366f1",
            }}>
              <strong>Therapist Notes ({rehabPlan.reviewedBy || "Therapist"}):</strong>{" "}
              {rehabPlan.therapistNotes}
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <h4>Total Sessions</h4>
          <h2>{totalSessions}</h2>
          <span className="chip info">{Object.keys(exerciseCounts).length} exercise{Object.keys(exerciseCounts).length !== 1 ? "s" : ""}</span>
        </div>
        <div className="kpi-card">
          <h4>Avg Reps / Session</h4>
          <h2>{avgReps}</h2>
          <span className="chip success">{totalReps} total reps</span>
        </div>
        <div className="kpi-card">
          <h4>Avg Duration / Session</h4>
          <h2>{avgDuration}s</h2>
          <span className="chip info">{Math.round(totalDuration)}s total</span>
        </div>
        {isPlanApproved && (
          <div className="kpi-card rehab">
            <h4>Rehab Sessions</h4>
            <h2>{rehabSessions}</h2>
            <span className="chip success">{rehabTotalReps} rehab reps</span>
          </div>
        )}
      </div>

      {/* Recovery Score */}
      <div className="recovery-score-section">
        <div className="recovery-score-card">
          <div className="score-ring-container">
            <svg className="score-ring" viewBox="0 0 120 120">
              <circle className="score-ring-bg" cx="60" cy="60" r="54" />
              <circle
                className="score-ring-fill"
                cx="60" cy="60" r="54"
                style={{
                  strokeDasharray: `${scoreDash} ${circumference}`,
                  stroke: scoreColor,
                }}
              />
            </svg>
            <div className="score-ring-text">
              <span className="score-number" style={{ color: scoreColor }}>{recoveryScore}</span>
              <span className="score-label">/ 100</span>
            </div>
          </div>
          <h3 className="score-title">Recovery Score</h3>
          <p className="score-subtitle">
            {recoveryScore >= 75 ? "Excellent recovery progress!" :
             recoveryScore >= 50 ? "Good progress — keep pushing!" :
             recoveryScore >= 25 ? "Building momentum — stay consistent" :
             "Getting started — every session counts!"}
          </p>
        </div>

        <div className="score-details-card">
          <div className="streak-badge-container">
            <div className={`streak-badge ${streak >= 3 ? "hot" : ""}`}>
              <span className="streak-fire">{streak >= 7 ? "🔥🔥" : streak >= 3 ? "🔥" : "💪"}</span>
              <span className="streak-count">{streak}</span>
              <span className="streak-text">Day{streak !== 1 ? "s" : ""} Streak</span>
            </div>
          </div>

          <div className="score-breakdown">
            <h4>Score Breakdown</h4>
            {scoreBreakdown.map((item) => (
              <div className="breakdown-row" key={item.label}>
                <span className="breakdown-icon">{item.icon}</span>
                <span className="breakdown-label">{item.label}</span>
                <div className="breakdown-bar-container">
                  <div
                    className="breakdown-bar-fill"
                    style={{ width: `${(item.score / item.max) * 100}%` }}
                  />
                </div>
                <span className="breakdown-value">{item.score}/{item.max}</span>
              </div>
            ))}
          </div>

          {scoreInsights.length > 0 && (
            <div className="score-insights">
              <h4>Insights</h4>
              {scoreInsights.map((insight, i) => (
                <div className={`insight-item ${insight.type}`} key={i}>
                  <span className="insight-icon">{insight.type === "positive" ? "+" : "⚠"}</span>
                  <span>{insight.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="chart-grid">
        <div className="chart-card">
          <h3>Reps Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={repsOverTime}>
              <XAxis dataKey="session" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="reps" stroke="#6366f1" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Exercise Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={exerciseDistribution} dataKey="value" nameKey="name" outerRadius={110} label>
                {exerciseDistribution.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card wide">
          <h3>Average Reps per Exercise</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={exercisePerformance}>
              <XAxis dataKey="exercise" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="avgReps" fill="#22c55e" name="Avg Reps" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rehabilitation Exercise Plan */}
      {isPlanApproved && (
        <>
          <div className="section-divider" />
          <h2 className="section-title">Rehabilitation Exercise Plan</h2>
          <p className="subtitle">
            {rehabExerciseIds.length} exercise{rehabExerciseIds.length !== 1 ? "s" : ""} assigned — tracking progress below.
          </p>

          <div className="exercise-plan-grid">
            {perExerciseProgress.map((ex) => (
              <div className="exercise-plan-card" key={ex.id}>
                <div className="exercise-plan-card-header">
                  <h4>{ex.name}</h4>
                  <span className={`difficulty-badge ${ex.difficulty}`}>{ex.difficulty}</span>
                </div>
                <p className="exercise-plan-desc">{ex.description}</p>

                <div className="exercise-plan-meta">
                  <div className="meta-item">
                    <span className="meta-label">Target</span>
                    <span className="meta-value">
                      {ex.holdSeconds > 0 ? `${ex.sets} x ${ex.holdSeconds}s hold` : `${ex.sets} x ${ex.reps} reps`}
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Frequency</span>
                    <span className="meta-value">{ex.frequencyPerWeek}x / week</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Muscle Group</span>
                    <span className="meta-value">{ex.muscleGroup}</span>
                  </div>
                </div>

                <div className="exercise-plan-progress">
                  <div className="progress-stats">
                    <span>{ex.sessionsCompleted} session{ex.sessionsCompleted !== 1 ? "s" : ""}</span>
                    <span>{ex.totalReps} reps</span>
                    <span>{Math.round(ex.totalDuration)}s</span>
                  </div>
                  <div className="progress-bar-container small">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${ex.progressPercent}%`,
                        background: ex.progressPercent >= 80 ? "#22c55e" : ex.progressPercent >= 40 ? "#f59e0b" : "#ef4444",
                      }}
                    />
                  </div>
                  <div className="progress-label">
                    <span>Avg {ex.avgReps} / {ex.targetReps} target reps</span>
                    <span>{ex.progressPercent}%</span>
                  </div>
                </div>

                {ex.lastSessionDate && (
                  <p className="last-session">Last session: {ex.lastSessionDate}</p>
                )}
              </div>
            ))}
          </div>

          {weeklySchedule.length > 0 && (
            <>
              <h3 className="subsection-title">Weekly Schedule</h3>
              <div className="weekly-schedule-grid">
                {weeklySchedule.map((day) => (
                  <div
                    className={`schedule-day-card ${day.exercises.length > 0 ? "active" : "rest"}`}
                    key={day.day}
                  >
                    <h5>{day.dayName}</h5>
                    {day.exercises.length === 0 ? (
                      <span className="rest-label">Rest Day</span>
                    ) : (
                      <ul>
                        {day.exercises.map((exId) => (
                          <li key={exId}>{toDisplayName(exId)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {rehabSessions > 0 && (
            <>
              <h3 className="subsection-title">Recovery Analytics</h3>
              <div className="chart-grid">
                <div className="chart-card">
                  <h3>Improvement Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={improvementTrend}>
                      <XAxis dataKey="session" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="reps" stroke="#6366f1" strokeWidth={2} name="Reps" dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="trend" stroke="#22c55e" strokeWidth={3} strokeDasharray="8 4" name="3-Session Avg" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <h3>Weekly Consistency</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={weeklyConsistency}>
                      <XAxis dataKey="day" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="sessions" fill="#8b5cf6" name="Sessions" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {radarData.length >= 3 && (
                  <div className="chart-card">
                    <h3>Exercise Completion Radar</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="exercise" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar name="Progress %" dataKey="progress" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="chart-card">
                  <h3>Rehab Reps Over Time</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={rehabRepsOverTime}>
                      <XAxis dataKey="session" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="reps" stroke="#22c55e" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <h3>Rehab Exercise Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={rehabExerciseDistribution} dataKey="value" nameKey="name" outerRadius={110} label>
                        {rehabExerciseDistribution.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {rehabSessions === 0 && (
            <div className="rehab-empty">
              <h3>No Rehab Sessions Yet</h3>
              <p>This patient hasn't performed any exercises from their rehab plan yet.</p>
            </div>
          )}
        </>
      )}

      {/* ==================== LIVE THERAPY SESSIONS ==================== */}
      {totalLiveSessions > 0 && (
        <>
          <div className="section-divider" />
          <h2 className="section-title">Live Therapy Sessions</h2>
          <p className="subtitle">
            {totalLiveSessions} video session{totalLiveSessions !== 1 ? "s" : ""} — {totalLiveExercises} exercises guided, {Math.round(totalLiveDuration / 60)} min total.
          </p>

          <div className="kpi-grid">
            <div className="kpi-card">
              <h4>Live Sessions</h4>
              <h2>{totalLiveSessions}</h2>
              <span className="chip info">📹 Video calls</span>
            </div>
            <div className="kpi-card">
              <h4>Exercises Guided</h4>
              <h2>{totalLiveExercises}</h2>
              <span className="chip success">By therapist</span>
            </div>
            <div className="kpi-card">
              <h4>Session Time</h4>
              <h2>{Math.round(totalLiveDuration / 60)}m</h2>
              <span className="chip info">Total</span>
            </div>
          </div>

          <div className="live-sessions-list">
            {liveSessions.map((ls, i) => (
              <div className="live-session-card" key={i}>
                <div className="live-session-header">
                  <div>
                    <h4>Session with Dr. {ls.therapistName || "Therapist"}</h4>
                    <span className="live-session-date">
                      {ls.date ? new Date(ls.date + "T00:00").toLocaleDateString() : new Date(ls.timestamp).toLocaleDateString()}
                      {ls.duration ? ` · ${Math.round(ls.duration / 60)} min` : ""}
                    </span>
                  </div>
                  <span className="live-session-badge">✅ Completed</span>
                </div>
                {ls.exercisesPerformed?.length > 0 && (
                  <div className="live-session-exercises">
                    {ls.exercisesPerformed.map((ex, j) => (
                      <div className="live-ex-chip" key={j}>
                        <strong>{ex.name}</strong>
                        <span>{ex.sets}×{ex.reps}</span>
                      </div>
                    ))}
                  </div>
                )}
                {ls.sessionNotes && (
                  <p className="live-session-notes"><strong>Notes:</strong> {ls.sessionNotes}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default PatientMonitor;
