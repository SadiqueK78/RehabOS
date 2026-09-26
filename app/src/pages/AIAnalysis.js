import React, { useEffect, useState, useRef } from "react";
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
import { doc, getDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebaseConfig";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Snackbar, Alert } from "@mui/material";
import content from "../assets/content.json";
import { sendReportEmail } from "../utils/helpers/EmailService";
import "./AIAnalysis.css";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function AIAnalysis() {
  const auth = getAuth();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [rehabPlan, setRehabPlan] = useState(null);
  const [emailStatus, setEmailStatus] = useState({ open: false, severity: "success", message: "" });
  const [emailing, setEmailing] = useState(false);
  const [liveSessions, setLiveSessions] = useState([]);
  const reportRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuth(true);
        await fetchHistory(user.email);
        await fetchRehabPlan(user.email);
        await fetchLiveSessions(user.email);
      } else {
        setIsAuth(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  const fetchHistory = async (email) => {
    try {
      const userDoc = await getDoc(doc(db, "users", email));
      if (userDoc.exists()) {
        const raw = userDoc.data().exerciseHistory || {};
        const entries = Object.entries(raw)
          .map(([ts, data]) => ({ timestamp: parseInt(ts), ...data }))
          .sort((a, b) => a.timestamp - b.timestamp);
        setHistory(entries);
      }
    } catch (err) {
      console.error("Error fetching exercise history:", err);
    }
  };

  const fetchRehabPlan = async (email) => {
    try {
      const userDoc = await getDoc(doc(db, "users", email));
      if (userDoc.exists() && userDoc.data().rehabPlan) {
        setRehabPlan(userDoc.data().rehabPlan);
      }
    } catch (err) {
      console.error("Error fetching rehab plan:", err);
    }
  };

  const fetchLiveSessions = async (email) => {
    try {
      const userDoc = await getDoc(doc(db, "users", email));
      if (userDoc.exists()) {
        const raw = userDoc.data().liveSessions || {};
        const entries = Object.entries(raw)
          .map(([ts, data]) => ({ timestamp: parseInt(ts), ...data }))
          .sort((a, b) => b.timestamp - a.timestamp);
        setLiveSessions(entries);
      }
    } catch (err) {
      console.error("Error fetching live sessions:", err);
    }
  };

  // --- Compute analytics from real data ---

  const totalSessions = history.length;
  const totalReps = history.reduce((sum, h) => sum + (h.repCount || 0), 0);
  const totalDuration = history.reduce((sum, h) => sum + (h.duration || 0), 0);
  const avgReps = totalSessions > 0 ? Math.round(totalReps / totalSessions) : 0;
  const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;

  // Reps over time (per session, chronological)
  const repsOverTime = history.map((h, i) => ({
    session: new Date(h.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    reps: h.repCount || 0,
  }));

  // Exercise distribution (pie chart: count of sessions per exercise)
  const exerciseCounts = {};
  history.forEach((h) => {
    const name = h.exercise || "Unknown";
    exerciseCounts[name] = (exerciseCounts[name] || 0) + 1;
  });
  const exerciseDistribution = Object.entries(exerciseCounts).map(([name, value]) => ({ name, value }));

  // Exercise-wise average reps (bar chart)
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

  // --- Rehab plan filtered analytics ---
  const isPlanApproved = rehabPlan && rehabPlan.status === "approved";

  // --- Live session analytics ---
  const totalLiveSessions = liveSessions.length;
  const totalLiveExercises = liveSessions.reduce((s, ls) => s + (ls.exercisesPerformed?.length || 0), 0);
  const totalLiveDuration = liveSessions.reduce((s, ls) => s + (ls.duration || 0), 0);
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
  const rehabTotalDuration = rehabHistory.reduce((sum, h) => sum + (h.duration || 0), 0);

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

  // Completion percentage
  const exercisesWithSessions = new Set(rehabHistory.map((h) => h.exercise));
  const rehabCompletionPercent = rehabExerciseIds.length > 0
    ? Math.round((exercisesWithSessions.size / rehabExerciseIds.length) * 100)
    : 0;

  // --- Per-exercise progress for plan cards ---
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
      description: content.catalog[exId] || "",
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

  // --- Weekly consistency (sessions per day of week) ---
  const weeklyConsistency = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
    const count = rehabHistory.filter((h) => new Date(h.timestamp).getDay() === ((i + 1) % 7)).length;
    return { day, sessions: count };
  });

  // --- Improvement trend: rolling average reps (window=3) ---
  const improvementTrend = rehabHistory.map((h, i, arr) => {
    const window = arr.slice(Math.max(0, i - 2), i + 1);
    const avg = Math.round(window.reduce((s, w) => s + (w.repCount || 0), 0) / window.length);
    return {
      session: new Date(h.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      reps: h.repCount || 0,
      trend: avg,
    };
  });

  // --- Radar chart: per-exercise completion ---
  const radarData = perExerciseProgress.map((ex) => ({
    exercise: ex.name.length > 12 ? ex.name.substring(0, 12) + "..." : ex.name,
    progress: ex.progressPercent,
    fullMark: 100,
  }));

  // --- Weekly schedule from plan ---
  const weeklySchedule = rehabPlan?.weeklySchedule || [];

  // ==================== AI RECOVERY SCORE ====================

  // Helper: get date string (YYYY-MM-DD) from timestamp
  const toDateStr = (ts) => new Date(ts).toISOString().split("T")[0];

  // --- Streak calculation (consecutive days with at least 1 session) ---
  const sessionDates = new Set(history.map((h) => toDateStr(h.timestamp)));
  let streak = 0;
  const today = new Date();
  for (let d = 0; d < 365; d++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - d);
    if (sessionDates.has(toDateStr(checkDate.getTime()))) {
      streak++;
    } else if (d > 0) {
      break; // allow today to be missing (streak counts until yesterday)
    }
  }

  // --- Recovery Score Components (0-100) ---
  // 1. Completed Sessions Score (30 pts)
  //    Based on ratio of rehab sessions done vs expected (frequency * weeks since plan)
  const planAgeWeeks = rehabPlan?.createdAt
    ? Math.max(1, Math.ceil((Date.now() - rehabPlan.createdAt) / (7 * 24 * 60 * 60 * 1000)))
    : 1;
  const totalExpectedFrequency = rehabExerciseDetails.reduce((s, d) => s + (d.frequencyPerWeek || 3), 0);
  const expectedSessions = totalExpectedFrequency * planAgeWeeks;
  const sessionScore = isPlanApproved
    ? Math.min(30, Math.round((rehabSessions / Math.max(1, expectedSessions)) * 30))
    : Math.min(30, Math.round((totalSessions / Math.max(1, totalSessions + 5)) * 30));

  // 2. Exercise Coverage Score (20 pts)
  const coverageScore = isPlanApproved
    ? Math.round((exercisesWithSessions.size / Math.max(1, rehabExerciseIds.length)) * 20)
    : Math.min(20, Object.keys(exerciseCounts).length * 4);

  // 3. Consistency Score (25 pts) — sessions in last 7 days
  const last7 = new Set();
  for (let d = 0; d < 7; d++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - d);
    if (sessionDates.has(toDateStr(checkDate.getTime()))) last7.add(d);
  }
  const consistencyScore = Math.round((last7.size / 7) * 25);

  // 4. Improvement Score (25 pts) — recent half avg reps vs first half
  const dataSource = isPlanApproved && rehabHistory.length >= 2 ? rehabHistory : history;
  let improvementScore = 12; // neutral default
  if (dataSource.length >= 4) {
    const mid = Math.floor(dataSource.length / 2);
    const firstHalf = dataSource.slice(0, mid);
    const secondHalf = dataSource.slice(mid);
    const avgFirst = firstHalf.reduce((s, h) => s + (h.repCount || 0), 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, h) => s + (h.repCount || 0), 0) / secondHalf.length;
    if (avgFirst > 0) {
      const pctChange = ((avgSecond - avgFirst) / avgFirst) * 100;
      // Map -50% .. +50% to 0..25
      improvementScore = Math.max(0, Math.min(25, Math.round(((pctChange + 50) / 100) * 25)));
    }
  }

  const recoveryScore = Math.min(100, sessionScore + coverageScore + consistencyScore + improvementScore);

  // Score breakdown for insights
  const scoreBreakdown = [
    { label: "Sessions", score: sessionScore, max: 30, icon: "📋" },
    { label: "Coverage", score: coverageScore, max: 20, icon: "🎯" },
    { label: "Consistency", score: consistencyScore, max: 25, icon: "📅" },
    { label: "Improvement", score: improvementScore, max: 25, icon: "📈" },
  ];

  // Generate text insights
  const scoreInsights = [];
  if (consistencyScore >= 18) scoreInsights.push({ text: "Great consistency this week!", type: "positive" });
  else if (consistencyScore <= 7) scoreInsights.push({ text: "Try to exercise more regularly", type: "warning" });
  if (improvementScore >= 18) scoreInsights.push({ text: "Strong improvement trend", type: "positive" });
  else if (improvementScore <= 7) scoreInsights.push({ text: "Reps declining — focus on form", type: "warning" });
  if (coverageScore >= 16) scoreInsights.push({ text: "Excellent exercise variety", type: "positive" });
  else if (coverageScore <= 5) scoreInsights.push({ text: "Try more of your plan exercises", type: "warning" });
  if (sessionScore >= 22) scoreInsights.push({ text: "Session targets on track", type: "positive" });
  else if (sessionScore <= 8) scoreInsights.push({ text: "More sessions needed to meet goals", type: "warning" });
  if (streak >= 7) scoreInsights.push({ text: `Amazing ${streak}-day streak!`, type: "positive" });
  else if (streak >= 3) scoreInsights.push({ text: `Nice ${streak}-day streak — keep going!`, type: "positive" });

  // Score color
  const scoreColor = recoveryScore >= 75 ? "#22c55e" : recoveryScore >= 50 ? "#f59e0b" : "#ef4444";

  // Score ring dasharray (circumference = 2 * PI * 54 ≈ 339.3)
  const circumference = 339.3;
  const scoreDash = (recoveryScore / 100) * circumference;

  // --- PDF report generation ---
  const generatePDFReport = async () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();

    // Title
    pdf.setFontSize(22);
    pdf.setFont("helvetica", "bold");
    pdf.text("Rehabilitation Progress Report", pageWidth / 2, 20, { align: "center" });

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Generated: ${new Date().toLocaleDateString()} | User: ${auth.currentUser?.email || "N/A"}`, pageWidth / 2, 28, { align: "center" });

    let y = 38;

    // Rehab Plan Details
    if (isPlanApproved) {
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Injury Details", 14, y);
      y += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const conditions = rehabPlan.matchedConditions?.join(", ") || "N/A";
      pdf.text(`Conditions Identified: ${conditions}`, 14, y);
      y += 6;
      pdf.text(`Plan Created: ${rehabPlan.createdAt ? new Date(rehabPlan.createdAt).toLocaleDateString() : "N/A"}`, 14, y);
      y += 6;
      pdf.text(`Recommended Exercises: ${rehabExerciseIds.length}`, 14, y);
      y += 6;

      if (rehabPlan.injuryDescription) {
        const desc = rehabPlan.injuryDescription.substring(0, 300);
        const lines = pdf.splitTextToSize(`Description: ${desc}`, pageWidth - 28);
        pdf.text(lines, 14, y);
        y += lines.length * 5 + 4;
      }
    }

    // Recovery Score
    y += 4;
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("AI Recovery Score", 14, y);
    y += 8;

    autoTable(pdf, {
      startY: y,
      head: [["Component", "Score", "Max"]],
      body: [
        ...scoreBreakdown.map((b) => [b.label, b.score.toString(), b.max.toString()]),
        ["TOTAL SCORE", recoveryScore.toString(), "100"],
        ["Recovery Streak", `${streak} day${streak !== 1 ? "s" : ""}`, "—"],
      ],
      theme: "grid",
      headStyles: { fillColor: [139, 92, 246] },
    });
    y = pdf.lastAutoTable.finalY + 6;

    if (scoreInsights.length > 0) {
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      scoreInsights.forEach((ins) => {
        pdf.text(`${ins.type === "positive" ? "+" : "⚠"} ${ins.text}`, 14, y);
        y += 5;
      });
    }
    y += 4;

    // Overall Stats
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Overall Performance Summary", 14, y);
    y += 8;

    autoTable(pdf, {
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["Total Sessions", totalSessions.toString()],
        ["Total Reps", totalReps.toString()],
        ["Avg Reps / Session", avgReps.toString()],
        ["Total Duration", `${Math.round(totalDuration)}s`],
        ["Avg Duration / Session", `${avgDuration}s`],
        ["Unique Exercises", Object.keys(exerciseCounts).length.toString()],
      ],
      theme: "grid",
      headStyles: { fillColor: [99, 102, 241] },
    });

    y = pdf.lastAutoTable.finalY + 10;

    // Rehab Progress Summary
    if (isPlanApproved) {
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Rehabilitation Progress Summary", 14, y);
      y += 8;

      autoTable(pdf, {
        startY: y,
        head: [["Metric", "Value"]],
        body: [
          ["Rehab Sessions Completed", rehabSessions.toString()],
          ["Rehab Reps Total", rehabTotalReps.toString()],
          ["Rehab Duration Total", `${Math.round(rehabTotalDuration)}s`],
          ["Exercise Coverage", `${rehabCompletionPercent}% (${exercisesWithSessions.size}/${rehabExerciseIds.length})`],
        ],
        theme: "grid",
        headStyles: { fillColor: [34, 197, 94] },
      });
      y = pdf.lastAutoTable.finalY + 10;

      // Exercise Plan Table
      if (y > 200) { pdf.addPage(); y = 20; }
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Exercise Plan Details", 14, y);
      y += 8;

      autoTable(pdf, {
        startY: y,
        head: [["Exercise", "Sets x Reps", "Frequency", "Muscle Group", "Difficulty", "Sessions Done", "Avg Reps", "Progress"]],
        body: perExerciseProgress.map((ex) => [
          ex.name,
          ex.holdSeconds > 0 ? `${ex.sets} x ${ex.holdSeconds}s hold` : `${ex.sets} x ${ex.reps}`,
          `${ex.frequencyPerWeek}x/week`,
          ex.muscleGroup,
          ex.difficulty,
          ex.sessionsCompleted.toString(),
          ex.avgReps.toString(),
          `${ex.progressPercent}%`,
        ]),
        theme: "grid",
        headStyles: { fillColor: [99, 102, 241] },
        styles: { fontSize: 7 },
      });
      y = pdf.lastAutoTable.finalY + 10;

      // Weekly Schedule
      if (weeklySchedule.length > 0) {
        if (y > 220) { pdf.addPage(); y = 20; }
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Weekly Rehabilitation Schedule", 14, y);
        y += 8;

        autoTable(pdf, {
          startY: y,
          head: [["Day", "Exercises"]],
          body: weeklySchedule.map((d) => [
            d.dayName,
            d.exercises.length > 0 ? d.exercises.map((id) => toDisplayName(id)).join(", ") : "Rest Day",
          ]),
          theme: "grid",
          headStyles: { fillColor: [34, 197, 94] },
          styles: { fontSize: 8 },
        });
        y = pdf.lastAutoTable.finalY + 10;
      }
    }

    // Session History Table
    if (history.length > 0) {
      if (y > 200) { pdf.addPage(); y = 20; }
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Session History (Last 30)", 14, y);
      y += 8;

      const rows = history.slice(-30).map((h) => [
        new Date(h.timestamp).toLocaleString(),
        h.exercise || "Unknown",
        (h.repCount || 0).toString(),
        `${Math.round(h.duration || 0)}s`,
        rehabExerciseIds.some((id) => matchesExercise(h, id)) ? "Yes" : "No",
      ]);

      autoTable(pdf, {
        startY: y,
        head: [["Date & Time", "Exercise", "Reps", "Duration", "Rehab Exercise"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [99, 102, 241] },
        styles: { fontSize: 7 },
      });
    }

    // Live Therapy Sessions
    if (liveSessions.length > 0) {
      let lsY = pdf.lastAutoTable ? pdf.lastAutoTable.finalY + 10 : y + 10;
      if (lsY > 200) { pdf.addPage(); lsY = 20; }
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Live Therapy Sessions", 14, lsY);
      lsY += 8;

      const lsRows = liveSessions.map((ls) => [
        ls.date || new Date(ls.timestamp).toLocaleDateString(),
        `Dr. ${ls.therapistName || "Therapist"}`,
        `${Math.round((ls.duration || 0) / 60)} min`,
        (ls.exercisesPerformed || []).map((e) => e.name).join(", ") || "N/A",
        ls.sessionNotes || "—",
      ]);

      autoTable(pdf, {
        startY: lsY,
        head: [["Date", "Therapist", "Duration", "Exercises", "Notes"]],
        body: lsRows,
        theme: "grid",
        headStyles: { fillColor: [34, 197, 94] },
        styles: { fontSize: 7 },
      });
    }

    // Disclaimer
    const finalY = pdf.lastAutoTable ? pdf.lastAutoTable.finalY + 15 : y + 15;
    if (finalY > 270) pdf.addPage();
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "italic");
    pdf.text(
      "Disclaimer: This report is generated from exercise tracking data and is not a medical document. Always consult a healthcare professional.",
      14,
      finalY > 270 ? 20 : finalY
    );

    pdf.save("rehabilitation-report.pdf");

    // Email the report to the logged-in user via SMTP backend
    setEmailing(true);
    try {
      const pdfBlob = pdf.output("blob");
      await sendReportEmail(
        pdfBlob,
        auth.currentUser?.email,
        auth.currentUser?.displayName
      );
      setEmailStatus({ open: true, severity: "success", message: "Report emailed to " + auth.currentUser?.email });
    } catch (err) {
      setEmailStatus({ open: true, severity: "error", message: "Email failed: " + err.message });
    } finally {
      setEmailing(false);
    }
  };

  if (loading) {
    return (
      <div className="ai-root">
        <h1>AI Exercise Analysis</h1>
        <p className="subtitle">Loading...</p>
      </div>
    );
  }

  if (!isAuth) {
    return (
      <div className="ai-root">
        <h1>AI Exercise Analysis</h1>
        <p className="subtitle">Please sign in to view your exercise analytics.</p>
      </div>
    );
  }

  if (totalSessions === 0) {
    return (
      <div className="ai-root">
        <h1>AI Exercise Analysis</h1>
        <p className="subtitle">
          No exercise data yet. Complete an exercise and save the summary to see your analytics here!
        </p>
      </div>
    );
  }

  return (
    <div className="ai-root" ref={reportRef}>
      <h1>AI Exercise Analysis</h1>
      <p className="subtitle">
        Insights based on your {totalSessions} recorded exercise session{totalSessions !== 1 ? "s" : ""}.
      </p>

      {/* Download Report Button */}
      <div style={{ textAlign: "right", marginBottom: "1rem" }}>
        <button className="download-btn" onClick={generatePDFReport} disabled={emailing}>
          {emailing ? "Sending…" : "Download & Email Report"}
        </button>
      </div>

      {/* Email Status Notification */}
      <Snackbar
        open={emailStatus.open}
        autoHideDuration={5000}
        onClose={() => setEmailStatus((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setEmailStatus((s) => ({ ...s, open: false }))}
          severity={emailStatus.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {emailStatus.message}
        </Alert>
      </Snackbar>

      {/* Rehab Plan Banner */}
      {isPlanPending && (
        <div className="rehab-banner" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div className="rehab-banner-header">
            <h3>Rehabilitation Plan Under Review</h3>
            <span className="rehab-status-badge" style={{ background: "#f59e0b" }}>Pending</span>
          </div>
          <p>
            Your rehabilitation plan is currently being reviewed by a physiotherapist.
            Plan details and recovery analytics will appear here once approved.
          </p>
          <p className="rehab-link">
            <Link to="/rehab-plan">View plan status</Link>
          </p>
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
          <p className="rehab-link">
            <Link to="/rehab-plan">Manage your rehabilitation plan</Link>
          </p>
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

      {/* ==================== AI RECOVERY SCORE ==================== */}
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
          {/* Streak */}
          <div className="streak-badge-container">
            <div className={`streak-badge ${streak >= 3 ? "hot" : ""}`}>
              <span className="streak-fire">{streak >= 7 ? "🔥🔥" : streak >= 3 ? "🔥" : "💪"}</span>
              <span className="streak-count">{streak}</span>
              <span className="streak-text">Day{streak !== 1 ? "s" : ""} Streak</span>
            </div>
          </div>

          {/* Score Breakdown */}
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

          {/* Insights */}
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
              <Pie data={exerciseDistribution} dataKey="value" nameKey="name" outerRadius={88} label>
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

      {/* ==================== REHABILITATION EXERCISE PLAN ==================== */}
      {isPlanApproved && (
        <>
          <div className="section-divider" />
          <h2 className="section-title">Rehabilitation Exercise Plan</h2>
          <p className="subtitle">
            Your personalized plan with {rehabExerciseIds.length} exercise{rehabExerciseIds.length !== 1 ? "s" : ""} — track each exercise's progress below.
          </p>

          {/* Per-Exercise Progress Cards */}
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

                <Link to={`/exercise?exercise=${ex.id}`} className="start-exercise-btn">
                  Start Exercise
                </Link>
              </div>
            ))}
          </div>

          {/* Weekly Schedule */}
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

          {/* Rehab Analytics Charts */}
          {rehabSessions > 0 && (
            <>
              <h3 className="subsection-title">Recovery Analytics</h3>
              <div className="chart-grid">
                {/* Improvement Trend */}
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

                {/* Weekly Consistency */}
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

                {/* Radar: Exercise Completion */}
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

                {/* Rehab Reps Over Time */}
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

                {/* Rehab Exercise Frequency */}
                <div className="chart-card">
                  <h3>Rehab Exercise Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={rehabExerciseDistribution} dataKey="value" nameKey="name" outerRadius={88} label>
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
              <p>
                Start performing your recommended exercises above and save your sessions to see
                recovery analytics here.{" "}
                <Link to="/rehab-plan">View your rehab plan</Link>
              </p>
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
            {totalLiveSessions} video session{totalLiveSessions !== 1 ? "s" : ""} with therapists — {totalLiveExercises} exercises guided, {Math.round(totalLiveDuration / 60)} minutes total.
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
              <span className="chip success">By therapists</span>
            </div>
            <div className="kpi-card">
              <h4>Session Time</h4>
              <h2>{Math.round(totalLiveDuration / 60)}m</h2>
              <span className="chip info">Total duration</span>
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
                  <p className="live-session-notes">
                    <strong>Notes:</strong> {ls.sessionNotes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default AIAnalysis;
