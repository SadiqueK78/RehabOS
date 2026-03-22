import React, { useState, useEffect } from "react";
import {
  Typography,
  TextField,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import VideocamIcon from "@mui/icons-material/Videocam";
import SendIcon from "@mui/icons-material/Send";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import HistoryIcon from "@mui/icons-material/History";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import "./BookSession.css";

function BookSession() {
  const auth = getAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [injuryDetails, setInjuryDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Appointments
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  // Real-time listener for user's appointments
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "appointments"),
      where("patientEmail", "==", user.email)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const appts = [];
      snap.forEach((d) => appts.push({ id: d.id, ...d.data() }));
      appts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setAppointments(appts);
    });
    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async () => {
    if (!preferredDate || !preferredTime || !injuryDetails.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "appointments"), {
        patientEmail: user.email,
        patientName: user.displayName || user.email,
        preferredDate,
        preferredTime,
        injuryDetails: injuryDetails.trim(),
        status: "pending",
        createdAt: Date.now(),
        therapistId: null,
        therapistName: null,
        scheduledDate: null,
        scheduledTime: null,
        exercisesPerformed: [],
        sessionNotes: "",
        sessionDuration: 0,
        completedAt: null,
      });
      toast.success("Session request submitted! A therapist will review it soon.");
      setPreferredDate("");
      setPreferredTime("");
      setInjuryDetails("");
      setConfirmOpen(false);
    } catch (err) {
      console.error("Error creating appointment:", err);
      toast.error("Failed to submit request. Please try again.");
    }
    setSubmitting(false);
  };

  const getStatusInfo = (status) => {
    const map = {
      pending: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Pending Review", icon: "⏳" },
      scheduled: { color: "#6366f1", bg: "rgba(99,102,241,0.1)", label: "Scheduled", icon: "📅" },
      "in-progress": { color: "#22c55e", bg: "rgba(34,197,94,0.1)", label: "In Progress", icon: "🟢" },
      completed: { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "Completed", icon: "✅" },
      cancelled: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "Cancelled", icon: "❌" },
    };
    return map[status] || { color: "#9ca3af", bg: "rgba(156,163,175,0.1)", label: status, icon: "❓" };
  };

  const canJoinSession = (appt) => {
    if (appt.status !== "scheduled") return false;
    if (!appt.scheduledDate || !appt.scheduledTime) return false;
    const scheduled = new Date(`${appt.scheduledDate}T${appt.scheduledTime}`);
    const now = new Date();
    const diffMin = (scheduled - now) / 60000;
    return diffMin <= 15 && diffMin >= -120; // 15 min before to 2 hrs after
  };

  const upcoming = appointments.filter((a) => a.status === "pending" || a.status === "scheduled");
  const past = appointments.filter((a) => a.status === "completed" || a.status === "cancelled");

  // Min date is today  
  const today = new Date().toISOString().split("T")[0];

  if (loading) {
    return (
      <div className="book-session-root">
        <div className="book-hero">
          <CircularProgress sx={{ color: "#818cf8" }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="book-session-root">
        <div className="book-hero">
          <div className="book-hero-glow" />
          <h1 className="book-hero-title">Live Therapy Sessions</h1>
          <p className="book-hero-subtitle">
            Sign in to request a live video exercise session with a licensed physiotherapist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="book-session-root">
      {/* Hero */}
      <div className="book-hero">
        <div className="book-hero-glow" />
        <h1 className="book-hero-title">Live Therapy Sessions</h1>
        <p className="book-hero-subtitle">
          Request a live video session with a physiotherapist. They'll guide you through exercises in real-time.
        </p>
      </div>

      {/* Booking Form */}
      <div className="book-form-section">
        <div className="book-form-card">
          <div className="form-header">
            <VideocamIcon sx={{ fontSize: 28, color: "#6366f1" }} />
            <h2>Request New Session</h2>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>
                <CalendarMonthIcon sx={{ fontSize: 18, verticalAlign: "middle", mr: 0.5 }} />
                Preferred Date
              </label>
              <input
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                min={today}
                className="form-input"
              />
            </div>

            <div className="form-field">
              <label>
                <AccessTimeIcon sx={{ fontSize: 18, verticalAlign: "middle", mr: 0.5 }} />
                Preferred Time
              </label>
              <input
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-field full">
            <label>Injury / Condition Details</label>
            <textarea
              value={injuryDetails}
              onChange={(e) => setInjuryDetails(e.target.value)}
              placeholder="Describe your injury or condition, any pain areas, and what you'd like to work on during the session..."
              rows={4}
              className="form-textarea"
              maxLength={1000}
            />
            <span className="char-count">{injuryDetails.length}/1000</span>
          </div>

          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => setConfirmOpen(true)}
            disabled={!preferredDate || !preferredTime || !injuryDetails.trim() || submitting}
            sx={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              textTransform: "none",
              fontWeight: 600,
              fontSize: "1rem",
              py: 1.2,
              borderRadius: 3,
              mt: 1,
              "&:hover": { background: "linear-gradient(135deg, #4f46e5, #7c3aed)" },
            }}
            fullWidth
          >
            Submit Request
          </Button>
        </div>
      </div>

      {/* Upcoming Appointments */}
      {upcoming.length > 0 && (
        <div className="appointments-section">
          <div className="section-header">
            <EventAvailableIcon sx={{ color: "#6366f1" }} />
            <h2>Upcoming Sessions</h2>
          </div>
          <div className="appointments-grid">
            {upcoming.map((appt) => {
              const status = getStatusInfo(appt.status);
              const joinable = canJoinSession(appt);
              return (
                <div className="appointment-card" key={appt.id}>
                  <div className="appt-header">
                    <Chip
                      label={status.label}
                      size="small"
                      sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600 }}
                    />
                    <span className="appt-status-icon">{status.icon}</span>
                  </div>

                  <div className="appt-details">
                    <div className="appt-detail">
                      <CalendarMonthIcon sx={{ fontSize: 16, color: "#9ca3af" }} />
                      <span>
                        {appt.status === "scheduled" && appt.scheduledDate
                          ? `${new Date(appt.scheduledDate + "T00:00").toLocaleDateString()} at ${appt.scheduledTime}`
                          : `Requested: ${new Date(appt.preferredDate + "T00:00").toLocaleDateString()} at ${appt.preferredTime}`}
                      </span>
                    </div>
                    <p className="appt-injury">{appt.injuryDetails}</p>
                    {appt.therapistName && (
                      <p className="appt-therapist">Therapist: Dr. {appt.therapistName}</p>
                    )}
                  </div>

                  {joinable && (
                    <Button
                      variant="contained"
                      startIcon={<VideocamIcon />}
                      onClick={() => navigate(`/session/${appt.id}`)}
                      sx={{
                        background: "linear-gradient(135deg, #22c55e, #16a34a)",
                        textTransform: "none",
                        fontWeight: 600,
                        borderRadius: 3,
                        mt: 1,
                      }}
                      fullWidth
                    >
                      Join Session
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Past Sessions */}
      {past.length > 0 && (
        <div className="appointments-section">
          <div className="section-header">
            <HistoryIcon sx={{ color: "#9ca3af" }} />
            <h2>Past Sessions</h2>
          </div>
          <div className="appointments-grid">
            {past.map((appt) => {
              const status = getStatusInfo(appt.status);
              return (
                <div className="appointment-card past" key={appt.id}>
                  <div className="appt-header">
                    <Chip
                      label={status.label}
                      size="small"
                      sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600 }}
                    />
                    <span className="appt-status-icon">{status.icon}</span>
                  </div>
                  <div className="appt-details">
                    <div className="appt-detail">
                      <CalendarMonthIcon sx={{ fontSize: 16, color: "#9ca3af" }} />
                      <span>
                        {appt.scheduledDate
                          ? new Date(appt.scheduledDate + "T00:00").toLocaleDateString()
                          : new Date(appt.preferredDate + "T00:00").toLocaleDateString()}
                      </span>
                    </div>
                    {appt.therapistName && (
                      <p className="appt-therapist">Dr. {appt.therapistName}</p>
                    )}
                    {appt.exercisesPerformed?.length > 0 && (
                      <div className="appt-exercises-summary">
                        <strong>{appt.exercisesPerformed.length} exercise{appt.exercisesPerformed.length !== 1 ? "s" : ""}</strong>
                        {" · "}
                        {Math.round((appt.sessionDuration || 0) / 60)} min
                      </div>
                    )}
                    {appt.sessionNotes && (
                      <p className="appt-notes">Notes: {appt.sessionNotes}</p>
                    )}
                  </div>
                  {appt.status === "completed" && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate(`/session/${appt.id}?review=true`)}
                      sx={{ textTransform: "none", fontWeight: 600, borderRadius: 3, mt: 1 }}
                      fullWidth
                    >
                      View Session Details
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {appointments.length === 0 && (
        <div className="no-appointments">
          <p>No sessions yet. Submit a request above to get started!</p>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Session Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Date:</strong> {preferredDate ? new Date(preferredDate + "T00:00").toLocaleDateString() : ""}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Time:</strong> {preferredTime}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Details:</strong> {injuryDetails}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 2 }}>
            A physiotherapist will review your request and schedule the session.
            You'll be able to join the video call at the scheduled time.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting}
            sx={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            {submitting ? "Submitting..." : "Confirm Request"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default BookSession;
