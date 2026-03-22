import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Tabs,
  Tab,
  TextField,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import LogoutIcon from "@mui/icons-material/Logout";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import AssignmentIcon from "@mui/icons-material/Assignment";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import PatientMonitor from "../components/PatientMonitor";
import AddIcon from "@mui/icons-material/Add";
import VideocamIcon from "@mui/icons-material/Videocam";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import ScheduleIcon from "@mui/icons-material/Schedule";
import content from "../assets/content.json";
import "./TherapistDashboard.css";

function TherapistDashboard() {
  const navigate = useNavigate();
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  // Plans
  const [pendingPlans, setPendingPlans] = useState([]);
  const [reviewedPlans, setReviewedPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // Users
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [monitoredUser, setMonitoredUser] = useState(null);

  // Appointments
  const [appointments, setAppointments] = useState([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulingAppt, setSchedulingAppt] = useState(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  // Review dialog
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewingPlan, setReviewingPlan] = useState(null);
  const [therapistNotes, setTherapistNotes] = useState("");
  const [modifiedExercises, setModifiedExercises] = useState([]);
  const [reviewAction, setReviewAction] = useState("");
  const [addExerciseId, setAddExerciseId] = useState(null);

  // All available exercises from catalog
  const allExercises = Object.entries(content.catalog || {}).map(([id, desc]) => ({
    id,
    name: id.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
    desc,
  }));

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/therapist/login");
        return;
      }
      const therapistDoc = await getDoc(doc(db, "therapists", user.uid));
      if (!therapistDoc.exists()) {
        await signOut(auth);
        navigate("/therapist/login");
        return;
      }
      setTherapist({ uid: user.uid, ...therapistDoc.data() });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (therapist) {
      fetchPlans();
      fetchUsers();
    }
  }, [therapist]);

  // Real-time appointment listener
  useEffect(() => {
    if (!therapist) return;
    const q = query(
      collection(db, "appointments"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const appts = [];
      snap.forEach((d) => appts.push({ id: d.id, ...d.data() }));
      setAppointments(appts);
    });
    return () => unsubscribe();
  }, [therapist]);

  const fetchPlans = async () => {
    setPlansLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const pending = [];
      const reviewed = [];

      usersSnap.forEach((userDoc) => {
        const data = userDoc.data();
        if (data.rehabPlan) {
          const plan = {
            userEmail: userDoc.id,
            userName: data.displayName || userDoc.id,
            ...data.rehabPlan,
          };
          if (data.rehabPlan.status === "pending") {
            pending.push(plan);
          } else if (data.rehabPlan.status === "approved" || data.rehabPlan.status === "rejected") {
            reviewed.push(plan);
          }
        }
      });

      pending.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      reviewed.sort((a, b) => (b.reviewedAt || 0) - (a.reviewedAt || 0));
      setPendingPlans(pending);
      setReviewedPlans(reviewed);
    } catch (err) {
      console.error("Error fetching plans:", err);
      toast.error("Failed to load rehabilitation plans.");
    }
    setPlansLoading(false);
  };

  const fetchUsers = async () => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const userList = [];
      usersSnap.forEach((userDoc) => {
        const data = userDoc.data();
        const history = data.exerciseHistory || {};
        const sessions = Object.keys(history).length;
        userList.push({
          email: userDoc.id,
          displayName: data.displayName || userDoc.id,
          sessions,
          rehabPlan: data.rehabPlan || null,
          exerciseHistory: history,
          liveSessions: data.liveSessions || {},
        });
      });
      userList.sort((a, b) => b.sessions - a.sessions);
      setUsers(userList);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const openReview = (plan, action) => {
    setReviewingPlan(plan);
    setReviewAction(action);
    setTherapistNotes("");
    setModifiedExercises(plan.exerciseDetails ? [...plan.exerciseDetails] : []);
    setReviewOpen(true);
  };

  const handleReviewSubmit = async () => {
    if (!reviewingPlan) return;
    try {
      const userRef = doc(db, "users", reviewingPlan.userEmail);
      const newStatus = reviewAction === "approve" ? "approved" : "rejected";

      const updateData = {
        "rehabPlan.status": newStatus,
        "rehabPlan.reviewedAt": Date.now(),
        "rehabPlan.reviewedBy": therapist.name,
        "rehabPlan.therapistNotes": therapistNotes,
      };

      if (reviewAction === "approve" && modifiedExercises.length > 0) {
        updateData["rehabPlan.exerciseDetails"] = modifiedExercises;
        updateData["rehabPlan.exercises"] = modifiedExercises.map((e) => e.id);
      }

      await updateDoc(userRef, updateData);
      toast.success(
        newStatus === "approved"
          ? "Plan approved and sent to patient!"
          : "Plan rejected. Patient will be notified."
      );
      setReviewOpen(false);
      fetchPlans();
    } catch (err) {
      console.error("Error updating plan:", err);
      toast.error("Failed to update plan.");
    }
  };

  const removeExerciseFromReview = (index) => {
    setModifiedExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const addExerciseToReview = () => {
    if (!addExerciseId) return;
    if (modifiedExercises.some((e) => e.id === addExerciseId.id)) {
      toast.error("Exercise already in plan");
      return;
    }
    setModifiedExercises((prev) => [
      ...prev,
      {
        id: addExerciseId.id,
        name: addExerciseId.name,
        reps: 10,
        sets: 3,
        holdSeconds: 0,
        frequencyPerWeek: 3,
        difficulty: "beginner",
        muscleGroup: "General",
      },
    ]);
    setAddExerciseId(null);
  };

  const updateExerciseField = (index, field, value) => {
    setModifiedExercises((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const openScheduleDialog = (appt) => {
    setSchedulingAppt(appt);
    setScheduleDate(appt.preferredDate || "");
    setScheduleTime(appt.preferredTime || "");
    setScheduleOpen(true);
  };

  const handleScheduleAppointment = async () => {
    if (!schedulingAppt || !scheduleDate || !scheduleTime) {
      toast.error("Please select a date and time.");
      return;
    }
    try {
      const apptRef = doc(db, "appointments", schedulingAppt.id);
      await updateDoc(apptRef, {
        status: "scheduled",
        scheduledDate: scheduleDate,
        scheduledTime: scheduleTime,
        therapistId: therapist.uid,
        therapistName: therapist.name,
      });
      toast.success("Appointment scheduled!");
      setScheduleOpen(false);

      // Send email notification to patient
      const sessionLink = `${window.location.origin}/session/${schedulingAppt.id}`;
      try {
        await fetch("http://localhost:5000/api/send-session-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientEmail: schedulingAppt.patientEmail,
            patientName: schedulingAppt.patientName,
            therapistName: therapist.name,
            scheduledDate: scheduleDate,
            scheduledTime: scheduleTime,
            sessionLink,
          }),
        });
        toast.success("Notification email sent to patient!");
      } catch (emailErr) {
        console.error("Failed to send notification email:", emailErr);
        toast.error("Appointment scheduled but email notification failed.");
      }
    } catch (err) {
      console.error("Error scheduling appointment:", err);
      toast.error("Failed to schedule appointment.");
    }
  };

  const handleCancelAppointment = async (apptId) => {
    try {
      await updateDoc(doc(db, "appointments", apptId), { status: "cancelled" });
      toast.success("Appointment cancelled.");
    } catch (err) {
      toast.error("Failed to cancel.");
    }
  };

  const canJoinSession = (appt) => {
    if (appt.status !== "scheduled" && appt.status !== "in-progress") return false;
    if (!appt.scheduledDate || !appt.scheduledTime) return false;
    const scheduled = new Date(`${appt.scheduledDate}T${appt.scheduledTime}`);
    const now = new Date();
    const diffMin = (scheduled - now) / 60000;
    return diffMin <= 15 && diffMin >= -120;
  };

  const pendingAppts = appointments.filter((a) => a.status === "pending");
  const scheduledAppts = appointments.filter((a) => a.status === "scheduled" || a.status === "in-progress");
  const completedAppts = appointments.filter((a) => a.status === "completed");

  const handleLogout = async () => {
    await signOut(getAuth());
    navigate("/therapist/login");
  };

  if (loading) {
    return (
      <Box className="therapist-loading">
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  const formatDate = (ts) => (ts ? new Date(ts).toLocaleDateString() : "N/A");

  const getStatusChip = (status) => {
    const map = {
      pending: { color: "warning", label: "Pending Review" },
      approved: { color: "success", label: "Approved" },
      rejected: { color: "error", label: "Rejected" },
      active: { color: "info", label: "Active (Legacy)" },
    };
    const s = map[status] || { color: "default", label: status };
    return <Chip label={s.label} color={s.color} size="small" />;
  };

  return (
    <Box className="therapist-dashboard">
      {/* Therapist Navbar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: "background.paper",
          borderRadius: 4,
          px: 3,
          py: 1.5,
          mb: 3,
          border: "1px solid",
          borderColor: "divider",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <LocalHospitalIcon sx={{ fontSize: 28, color: "#6366f1" }} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            RehabOS <span style={{ fontWeight: 400, opacity: 0.6 }}>Therapist</span>
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            icon={<DashboardIcon />}
            label={`Dr. ${therapist.name}`}
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
          <Button
            variant="outlined"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            size="small"
            sx={{ textTransform: "none" }}
          >
            Logout
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab
          label={`Pending Plans (${pendingPlans.length})`}
          sx={{ textTransform: "none", fontWeight: 600 }}
        />
        <Tab
          label="Patient Analytics"
          sx={{ textTransform: "none", fontWeight: 600 }}
        />
        <Tab
          label={`Reviewed Plans (${reviewedPlans.length})`}
          sx={{ textTransform: "none", fontWeight: 600 }}
        />
        <Tab
          icon={<EventAvailableIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label={`Appointments (${pendingAppts.length + scheduledAppts.length})`}
          sx={{ textTransform: "none", fontWeight: 600 }}
        />
        {monitoredUser && (
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                Monitor: {monitoredUser.displayName}
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMonitoredUser(null);
                    setTab(1);

                  }}
                  sx={{ ml: 0.5, p: 0.25 }}
                >
                  <CancelIcon fontSize="small" />
                </IconButton>
              </Box>
            }
            sx={{ textTransform: "none", fontWeight: 600, color: "#6366f1" }}
          />
        )}
      </Tabs>

      {/* Tab 0: Pending Plans */}
      {tab === 0 && (
        <Box>
          {plansLoading ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : pendingPlans.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 3 }}>
              No pending rehabilitation plans to review.
            </Alert>
          ) : (
            <Box className="plans-grid">
              {pendingPlans.map((plan, i) => (
                <Card key={i} className="plan-card">
                  <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start", mb: 1.5 }}>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                          <PersonIcon fontSize="small" color="primary" />
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {plan.userName}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          {plan.userEmail}
                        </Typography>
                      </Box>
                      {getStatusChip(plan.status)}
                    </Box>

                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Injury Description:
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        mb: 1.5,
                        maxHeight: 80,
                        overflow: "auto",
                        bgcolor: "rgba(99,102,241,0.05)",
                        p: 1,
                        borderRadius: 1,
                      }}
                    >
                      {plan.injuryDescription || "No description provided"}
                    </Typography>

                    {plan.matchedConditions && (
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1.5 }}>
                        {plan.matchedConditions.map((c) => (
                          <Chip key={c} label={c} size="small" variant="outlined" color="primary" />
                        ))}
                      </Box>
                    )}

                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <FitnessCenterIcon sx={{ fontSize: 16, verticalAlign: "middle", mr: 0.5 }} />
                      {plan.exerciseDetails?.length || 0} exercises &middot;{" "}
                      <CalendarMonthIcon sx={{ fontSize: 16, verticalAlign: "middle", mr: 0.5 }} />
                      Created {formatDate(plan.createdAt)}
                    </Typography>

                    {plan.exerciseDetails && (
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 2 }}>
                        {plan.exerciseDetails.map((ex) => (
                          <Chip key={ex.id} label={ex.name} size="small" />
                        ))}
                      </Box>
                    )}

                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => openReview(plan, "approve")}
                        sx={{ flex: 1, textTransform: "none" }}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="contained"
                        color="warning"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => openReview(plan, "approve")}
                        sx={{ flex: 1, textTransform: "none" }}
                      >
                        Modify
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<CancelIcon />}
                        onClick={() => openReview(plan, "reject")}
                        sx={{ flex: 1, textTransform: "none" }}
                      >
                        Reject
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Tab 1: Patient Analytics */}
      {tab === 1 && (
        <Box>
          {users.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 3 }}>
              No patient data available.
            </Alert>
          ) : (
            <Box className="users-grid">
              {users.map((user) => (
                <Card
                  key={user.email}
                  className={`user-card ${selectedUser === user.email ? "selected" : ""}`}
                  onClick={() =>
                    setSelectedUser(selectedUser === user.email ? null : user.email)
                  }
                >
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                      <PersonIcon color="primary" />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {user.displayName}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                      {user.email}
                    </Typography>

                    <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: "#6366f1" }}>
                          {user.sessions}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          Sessions
                        </Typography>
                      </Box>
                      {user.rehabPlan && (
                        <Box>
                          {getStatusChip(user.rehabPlan.status)}
                        </Box>
                      )}
                    </Box>

                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AssignmentIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMonitoredUser(user);
                        setTab(4);
                      }}
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        mb: 1,
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      }}
                      fullWidth
                    >
                      Monitor Patient
                    </Button>

                    {/* Expanded details */}
                    {selectedUser === user.email && (
                      <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid rgba(150,150,150,0.2)" }}>
                        {user.rehabPlan ? (
                          <>
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                              Rehab Plan:
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                              Conditions: {user.rehabPlan.matchedConditions?.join(", ") || "N/A"}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              Exercises: {user.rehabPlan.exercises?.join(", ") || "None"}
                            </Typography>
                          </>
                        ) : (
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            No rehabilitation plan assigned.
                          </Typography>
                        )}

                        {Object.keys(user.exerciseHistory).length > 0 && (
                          <Box sx={{ mt: 1.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                              Recent Sessions:
                            </Typography>
                            {Object.entries(user.exerciseHistory)
                              .sort(([a], [b]) => parseInt(b) - parseInt(a))
                              .slice(0, 5)
                              .map(([ts, data]) => (
                                <Typography key={ts} variant="body2" sx={{ color: "text.secondary" }}>
                                  {new Date(parseInt(ts)).toLocaleDateString()} —{" "}
                                  {data.exercise} ({data.repCount} reps, {Math.round(data.duration)}s)
                                </Typography>
                              ))}
                          </Box>
                        )}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Tab 2: Reviewed Plans */}
      {tab === 2 && (
        <Box>
          {reviewedPlans.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 3 }}>
              No reviewed plans yet.
            </Alert>
          ) : (
            <Box className="plans-grid">
              {reviewedPlans.map((plan, i) => (
                <Card key={i} className="plan-card">
                  <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start", mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {plan.userName}
                      </Typography>
                      {getStatusChip(plan.status)}
                    </Box>
                    <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                      Reviewed {formatDate(plan.reviewedAt)} by {plan.reviewedBy || "—"}
                    </Typography>
                    {plan.therapistNotes && (
                      <Typography
                        variant="body2"
                        sx={{
                          bgcolor: "rgba(99,102,241,0.05)",
                          p: 1,
                          borderRadius: 1,
                          mb: 1,
                        }}
                      >
                        Notes: {plan.therapistNotes}
                      </Typography>
                    )}
                    {plan.exerciseDetails && (
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {plan.exerciseDetails.map((ex) => (
                          <Chip key={ex.id} label={ex.name} size="small" />
                        ))}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Tab 3: Appointments */}
      {tab === 3 && (
        <Box>
          {/* Pending Appointment Requests */}
          {pendingAppts.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <ScheduleIcon sx={{ color: "#f59e0b" }} /> Pending Requests ({pendingAppts.length})
              </Typography>
              <Box className="plans-grid">
                {pendingAppts.map((appt) => (
                  <Card key={appt.id} className="plan-card">
                    <CardContent>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
                        <Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                            <PersonIcon fontSize="small" color="primary" />
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {appt.patientName}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            {appt.patientEmail}
                          </Typography>
                        </Box>
                        <Chip label="Pending" color="warning" size="small" />
                      </Box>

                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Preferred Date & Time:</Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                        {appt.preferredDate ? new Date(appt.preferredDate + "T00:00").toLocaleDateString() : "N/A"}{" "}
                        at {appt.preferredTime || "N/A"}
                      </Typography>

                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Injury Details:</Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", mb: 2, bgcolor: "rgba(99,102,241,0.05)", p: 1, borderRadius: 1, maxHeight: 80, overflow: "auto" }}
                      >
                        {appt.injuryDetails || "No details provided"}
                      </Typography>

                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<EventAvailableIcon />}
                          onClick={() => openScheduleDialog(appt)}
                          sx={{ flex: 1, textTransform: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                        >
                          Schedule
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={<CancelIcon />}
                          onClick={() => handleCancelAppointment(appt.id)}
                          sx={{ textTransform: "none" }}
                        >
                          Decline
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          )}

          {/* Scheduled Sessions */}
          {scheduledAppts.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <EventAvailableIcon sx={{ color: "#6366f1" }} /> Scheduled Sessions ({scheduledAppts.length})
              </Typography>
              <Box className="plans-grid">
                {scheduledAppts.map((appt) => (
                  <Card key={appt.id} className="plan-card" sx={{ borderColor: "rgba(99,102,241,0.3)" }}>
                    <CardContent>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{appt.patientName}</Typography>
                        <Chip
                          label={appt.status === "in-progress" ? "In Progress" : "Scheduled"}
                          color={appt.status === "in-progress" ? "success" : "primary"}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                        {appt.scheduledDate ? new Date(appt.scheduledDate + "T00:00").toLocaleDateString() : ""}{" "}
                        at {appt.scheduledTime}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2, fontSize: "0.85rem" }}>
                        {appt.injuryDetails}
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<VideocamIcon />}
                        onClick={() => navigate(`/session/${appt.id}`)}
                        disabled={!canJoinSession(appt) && appt.status !== "in-progress"}
                        sx={{
                          textTransform: "none",
                          fontWeight: 600,
                          background: canJoinSession(appt) || appt.status === "in-progress"
                            ? "linear-gradient(135deg, #22c55e, #16a34a)"
                            : undefined,
                        }}
                        fullWidth
                      >
                        {appt.status === "in-progress" ? "Rejoin Session" : "Join Session"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          )}

          {/* Completed Sessions */}
          {completedAppts.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <CheckCircleIcon sx={{ color: "#22c55e" }} /> Completed Sessions ({completedAppts.length})
              </Typography>
              <Box className="plans-grid">
                {completedAppts.map((appt) => (
                  <Card key={appt.id} className="plan-card" sx={{ opacity: 0.85 }}>
                    <CardContent>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{appt.patientName}</Typography>
                        <Chip label="Completed" color="success" size="small" />
                      </Box>
                      <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
                        {appt.scheduledDate ? new Date(appt.scheduledDate + "T00:00").toLocaleDateString() : ""}
                        {appt.sessionDuration ? ` · ${Math.round(appt.sessionDuration / 60)} min` : ""}
                      </Typography>
                      {appt.exercisesPerformed?.length > 0 && (
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 1 }}>
                          {appt.exercisesPerformed.map((ex, i) => (
                            <Chip key={i} label={ex.name} size="small" variant="outlined" />
                          ))}
                        </Box>
                      )}
                      {appt.sessionNotes && (
                        <Typography variant="body2" sx={{ color: "text.secondary", mt: 1, fontStyle: "italic" }}>
                          Notes: {appt.sessionNotes}
                        </Typography>
                      )}
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => navigate(`/session/${appt.id}?review=true`)}
                        sx={{ textTransform: "none", fontWeight: 600, mt: 1.5, borderRadius: 2 }}
                        fullWidth
                      >
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          )}

          {pendingAppts.length === 0 && scheduledAppts.length === 0 && completedAppts.length === 0 && (
            <Alert severity="info" sx={{ borderRadius: 3 }}>
              No appointment requests or sessions yet.
            </Alert>
          )}
        </Box>
      )}

      {/* Tab 4: Monitor Patient */}
      {tab === 4 && monitoredUser && (
        <Box>
          <Button
            variant="text"
            onClick={() => { setMonitoredUser(null); setTab(1); }}
            sx={{ textTransform: "none", mb: 2, fontWeight: 600 }}
          >
            ← Back to Patient Analytics
          </Button>
          <PatientMonitor
            patientName={monitoredUser.displayName}
            patientEmail={monitoredUser.email}
            exerciseHistory={monitoredUser.exerciseHistory}
            rehabPlan={monitoredUser.rehabPlan}
            liveSessions={monitoredUser.liveSessions}
          />
        </Box>
      )}

      {/* Schedule Appointment Dialog */}
      <Dialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Schedule Appointment</DialogTitle>
        <DialogContent>
          {schedulingAppt && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Patient: {schedulingAppt.patientName} ({schedulingAppt.patientEmail})
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
                Preferred: {schedulingAppt.preferredDate} at {schedulingAppt.preferredTime}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                Injury: {schedulingAppt.injuryDetails}
              </Typography>
              <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                <TextField
                  label="Date"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label="Time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setScheduleOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleScheduleAppointment}
            disabled={!scheduleDate || !scheduleTime}
            sx={{ textTransform: "none", fontWeight: 600, background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            Confirm Schedule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Review Dialog */}
      <Dialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {reviewAction === "approve" ? "Review & Approve Plan" : "Reject Plan"}
        </DialogTitle>
        <DialogContent>
          {reviewingPlan && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Patient: {reviewingPlan.userName} ({reviewingPlan.userEmail})
              </Typography>

              <Typography variant="body2" sx={{ fontWeight: 600, mt: 2, mb: 0.5 }}>
                Injury Description:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  bgcolor: "rgba(99,102,241,0.05)",
                  p: 1.5,
                  borderRadius: 1,
                  mb: 2,
                }}
              >
                {reviewingPlan.injuryDescription || "No description"}
              </Typography>

              {reviewAction === "approve" && (
                <>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    Exercises (modify as needed):
                  </Typography>
                  {modifiedExercises.map((ex, i) => (
                    <Card
                      key={i}
                      sx={{ mb: 1, p: 1.5, borderRadius: 2 }}
                      variant="outlined"
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600, flex: 1 }}>
                          {ex.name}
                        </Typography>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeExerciseFromReview(i)}
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        <TextField
                          label="Sets"
                          type="number"
                          size="small"
                          value={ex.sets || ""}
                          onChange={(e) => updateExerciseField(i, "sets", parseInt(e.target.value) || 0)}
                          sx={{ width: 80 }}
                        />
                        <TextField
                          label="Reps"
                          type="number"
                          size="small"
                          value={ex.reps || ""}
                          onChange={(e) => updateExerciseField(i, "reps", parseInt(e.target.value) || 0)}
                          sx={{ width: 80 }}
                        />
                        <TextField
                          label="Freq/Week"
                          type="number"
                          size="small"
                          value={ex.frequencyPerWeek || ""}
                          onChange={(e) =>
                            updateExerciseField(i, "frequencyPerWeek", parseInt(e.target.value) || 0)
                          }
                          sx={{ width: 100 }}
                        />
                      </Box>
                    </Card>
                  ))}

                  {/* Add New Exercise */}
                  <Box
                    sx={{
                      display: "flex",
                      gap: 1,
                      alignItems: "center",
                      mt: 2,
                      p: 1.5,
                      border: "1px dashed",
                      borderColor: "divider",
                      borderRadius: 2,
                    }}
                  >
                    <Autocomplete
                      size="small"
                      options={allExercises.filter(
                        (e) => !modifiedExercises.some((m) => m.id === e.id)
                      )}
                      getOptionLabel={(opt) => opt.name}
                      renderOption={(props, opt) => (
                        <li {...props} key={opt.id}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {opt.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              {opt.desc}
                            </Typography>
                          </Box>
                        </li>
                      )}
                      value={addExerciseId}
                      onChange={(_, val) => setAddExerciseId(val)}
                      sx={{ flex: 1 }}
                      renderInput={(params) => (
                        <TextField {...params} label="Add exercise to plan" placeholder="Search exercises..." />
                      )}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={addExerciseToReview}
                      disabled={!addExerciseId}
                      sx={{ textTransform: "none", fontWeight: 600, whiteSpace: "nowrap" }}
                    >
                      Add
                    </Button>
                  </Box>
                </>
              )}

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Therapist Notes"
                placeholder={
                  reviewAction === "approve"
                    ? "Add any notes or instructions for the patient..."
                    : "Explain why this plan is being rejected..."
                }
                value={therapistNotes}
                onChange={(e) => setTherapistNotes(e.target.value)}
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReviewOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={reviewAction === "approve" ? "success" : "error"}
            onClick={handleReviewSubmit}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {reviewAction === "approve" ? "Approve Plan" : "Reject Plan"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TherapistDashboard;
