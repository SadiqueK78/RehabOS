import React, { lazy, Suspense, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Checkbox,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import FavoriteIcon from "@mui/icons-material/Favorite";
import BloodtypeIcon from "@mui/icons-material/Bloodtype";
import BedtimeIcon from "@mui/icons-material/Bedtime";
import MoodIcon from "@mui/icons-material/Mood";
import EventNoteIcon from "@mui/icons-material/EventNote";
import DirectionsRunIcon from "@mui/icons-material/DirectionsRun";
import MedicationIcon from "@mui/icons-material/Medication";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import HealingIcon from "@mui/icons-material/Healing";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import InsightsIcon from "@mui/icons-material/Insights";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import VideocamIcon from "@mui/icons-material/Videocam";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import AddIcon from "@mui/icons-material/Add";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import {
  usePatient,
  latestVitals,
  VITALS,
  MOODS,
  todaysPlan,
  setPlanDone,
  dateKey,
  exerciseStreak,
  weekSummary,
  sortedSessions,
} from "../utils/patient/patientData";
import { SectionCard, StatTile, IconBubble, SignInPrompt, usePatientAppointments, appointmentWhen } from "../components/patient/ui";
import HealthLogDialog from "../components/patient/HealthLogDialog";
import HappyMeterCard from "../components/patient/HappyMeterCard";
import ReminderDialog from "../components/patient/ReminderDialog";
import TwinPicker, { useTwinChoice } from "../components/patient/TwinPicker";

// The 3D twin pulls in three.js, so load it only when the dashboard is shown.
const TwinViewer = lazy(() => import("../components/patient/TwinViewer"));

const PLAN_ICON = {
  exercise: [<DirectionsRunIcon />, "success"],
  medication: [<MedicationIcon />, "secondary"],
  hydration: [<WaterDropIcon />, "info"],
  appointment: [<MedicalServicesIcon />, "warning"],
  custom: [<NotificationsActiveIcon />, "primary"],
};

const greeting = (h = new Date().getHours()) => (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");

/**
 * Patient home: greeting, Digital Twin snapshot with the latest readings, Today's Plan
 * (rehab exercises, reminders, appointments), progress and quick links.
 */
function PatientDashboard() {
  const theme = useTheme();
  const { user, data, loading } = usePatient();
  const appointments = usePatientAppointments(user?.email);
  const [logOpen, setLogOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const twin = useTwinChoice(user, data?.profile);

  const vitals = useMemo(() => latestVitals(data?.healthLogs), [data]);
  const plan = useMemo(() => (data ? todaysPlan({ ...data, appointments }) : []), [data, appointments]);
  const streak = useMemo(() => exerciseStreak(data?.exerciseHistory), [data]);
  const week = useMemo(() => weekSummary(data?.exerciseHistory), [data]);
  // Minutes of exercise on each of the last 7 days.
  const activity = useMemo(() => {
    const sessions = sortedSessions(data?.exerciseHistory);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = dateKey(d);
      const secs = sessions.filter((s) => dateKey(new Date(s.at)) === key).reduce((a, s) => a + (s.duration || 0), 0);
      return { label: d.toLocaleDateString(undefined, { weekday: "narrow" }), minutes: Math.round(secs / 60) };
    });
  }, [data]);

  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user) return <SignInPrompt />;

  const name = (data?.profile?.name || user.displayName || "").split(" ")[0];
  const today = new Date();
  const doneCount = plan.filter((i) => i.done).length;

  const toggle = (item) => {
    const key = dateKey();
    const current = new Set(data?.planDone?.[key] || []);
    if (current.has(item.id)) current.delete(item.id);
    else current.add(item.id);
    setPlanDone(user.email, key, [...current]);
  };

  const upcoming = appointments
    .filter((a) => ["pending", "approved", "scheduled"].includes(a.status))
    .filter((a) => (a.scheduledDate || a.preferredDate || "9999") >= dateKey())
    .sort((a, b) => (a.scheduledDate || a.preferredDate || "").localeCompare(b.scheduledDate || b.preferredDate || ""))
    .slice(0, 3);

  const bp = vitals.bloodPressure;
  const progressText =
    streak >= 3 ? `${streak} days in a row — keep it going!` : week.sessions ? "Every small step counts towards a healthier you." : "Start with one short exercise today.";

  const quick = [
    { label: "Exercise Library", to: "/catalog", icon: <FitnessCenterIcon />, color: "primary" },
    { label: "My Rehab Plan", to: "/rehab-plan", icon: <HealingIcon />, color: "success" },
    { label: "My Health", to: "/digital-twin", icon: <MonitorHeartIcon />, color: "error" },
    { label: "Appointments", to: "/book-session", icon: <VideocamIcon />, color: "warning" },
    { label: "Progress", to: "/myExerSights", icon: <InsightsIcon />, color: "info" },
    { label: "Help & FAQ", to: "/faq", icon: <HelpOutlineIcon />, color: "secondary" },
  ];

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 1.5, md: 3 }, py: { xs: 2, md: 3 } }}>
      {/* Greeting */}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} sx={{ mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: 26, md: 32 } }}>
            {greeting()}
            {name ? `, ${name}` : ""}!
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 17 }}>
            Your Digital Twin is here to support your recovery journey.
          </Typography>
        </Box>
        <Button variant="contained" size="large" startIcon={<AddIcon />} onClick={() => setLogOpen(true)} sx={{ borderRadius: 3, px: 3 }}>
          Log today's health
        </Button>
      </Stack>

      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", md: "repeat(12, 1fr)" } }}>
        {/* Digital Twin */}
        <Box sx={{ gridColumn: { md: "span 7" } }}>
          <SectionCard
            title="Your Digital Twin"
            icon={<MonitorHeartIcon />}
            action={
              <Button component={RouterLink} to="/digital-twin" endIcon={<ChevronRightIcon />}>
                View details
              </Button>
            }>
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, alignItems: "stretch" }}>
              <Box
                sx={{
                  borderRadius: 3,
                  minHeight: 330,
                  bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.05),
                }}>
                <Suspense fallback={<Box sx={{ height: 330 }} />}>
                  <TwinViewer avatarId={twin.avatarId} ready={twin.ready} height="100%" minHeight={330} />
                </Suspense>
                <TwinPicker
                  value={twin.avatarId}
                  onChange={twin.choose}
                  available={twin.available}
                  sx={{ position: "relative", mt: -6, mb: 1.5, display: "flex", justifyContent: "center" }}
                />
              </Box>
              <Stack spacing={1.5} justifyContent="center">
                <StatTile
                  icon={<FavoriteIcon />}
                  color="error"
                  label="Heart rate"
                  value={vitals.heartRate?.value}
                  unit="bpm"
                  status={vitals.heartRate && VITALS.heartRate.classify(vitals.heartRate.value)}
                />
                <StatTile
                  icon={<BloodtypeIcon />}
                  color="secondary"
                  label="Blood pressure"
                  value={bp ? `${bp.value[0]}/${bp.value[1]}` : undefined}
                  unit="mmHg"
                  status={bp && VITALS.bloodPressure.classify(bp.value)}
                />
                <StatTile
                  icon={<BedtimeIcon />}
                  color="info"
                  label="Sleep"
                  value={vitals.sleepHours?.value}
                  unit="h"
                  status={vitals.sleepHours && VITALS.sleepHours.classify(vitals.sleepHours.value)}
                />
                <StatTile
                  icon={<MoodIcon />}
                  color="warning"
                  label="Mood · Pain"
                  value={[vitals.mood && MOODS[vitals.mood.value - 1], vitals.pain && `pain ${vitals.pain.value}/10`].filter(Boolean).join(" · ") || undefined}
                />
                {!Object.keys(vitals).length && (
                  <Typography variant="body2" color="text.secondary">
                    No readings yet. Tap “Log today's health” to add your first ones.
                  </Typography>
                )}
              </Stack>
            </Box>
          </SectionCard>
        </Box>

        {/* Today's plan */}
        <Box sx={{ gridColumn: { md: "span 5" } }}>
          <SectionCard
            title="Today's Plan"
            icon={<EventNoteIcon />}
            action={
              <Button size="small" onClick={() => setRemindersOpen(true)}>
                Reminders
              </Button>
            }>
            <Typography color="text.secondary" sx={{ mt: -1.5, mb: 1.5 }}>
              {today.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
              {plan.length > 0 && ` · ${doneCount} of ${plan.length} done`}
            </Typography>
            {plan.length === 0 ? (
              <Box sx={{ py: 2 }}>
                <Typography sx={{ mb: 2 }}>
                  Nothing planned yet. Create a rehab plan from your injury details, and add your medicines or water reminders.
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button variant="contained" component={RouterLink} to="/rehab-plan">
                    Create rehab plan
                  </Button>
                  <Button variant="outlined" onClick={() => setRemindersOpen(true)}>
                    Add reminders
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Stack spacing={1}>
                {plan.map((item) => {
                  const [icon, color] = PLAN_ICON[item.type] || PLAN_ICON.custom;
                  return (
                    <Card key={item.id} variant="outlined" sx={{ borderRadius: 3, opacity: item.done ? 0.7 : 1 }}>
                      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.25 }}>
                        <IconBubble color={color}>{icon}</IconBubble>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 600, textDecoration: item.done ? "line-through" : "none" }} noWrap>
                            {item.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {[item.time, item.subtitle].filter(Boolean).join(" · ")}
                          </Typography>
                        </Box>
                        {item.type === "exercise" && !item.done && (
                          <Button size="small" variant="contained" component={RouterLink} to={item.link}>
                            Start
                          </Button>
                        )}
                        <Checkbox checked={item.done} onChange={() => toggle(item)} inputProps={{ "aria-label": `Mark ${item.title} done` }} />
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </SectionCard>
        </Box>

        {/* Progress */}
        <Box sx={{ gridColumn: { md: "span 4" } }}>
          <SectionCard title="Your progress" icon={<LocalFireDepartmentIcon />}>
            <Typography sx={{ fontSize: 18, fontWeight: 600, mb: 2 }}>{progressText}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5, textAlign: "center" }}>
              {[
                [streak, "day streak"],
                [week.sessions, "sessions this week"],
                [week.minutes, "minutes this week"],
              ].map(([n, label]) => (
                <Card key={label} variant="outlined" sx={{ py: 1.5, borderRadius: 3 }}>
                  <Typography sx={{ fontSize: 28, fontWeight: 700, color: "primary.main" }}>{n}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {label}
                  </Typography>
                </Card>
              ))}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Minutes of exercise, last 7 days
            </Typography>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={activity} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: theme.palette.text.secondary }} />
                <Bar dataKey="minutes" fill={theme.palette.primary.main} radius={[5, 5, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </Box>

        {/* Happy meter */}
        <Box sx={{ gridColumn: { md: "span 4" } }}>
          <HappyMeterCard email={user.email} healthLogs={data?.healthLogs} sx={{ height: "100%" }} />
        </Box>

        {/* Appointments */}
        <Box sx={{ gridColumn: { md: "span 4" } }}>
          <SectionCard
            title="Appointments"
            icon={<VideocamIcon />}
            action={
              <Button size="small" component={RouterLink} to="/book-session">
                Book new
              </Button>
            }>
            {upcoming.length === 0 ? (
              <Typography color="text.secondary">No upcoming sessions. Book a video session with a physiotherapist when you need one.</Typography>
            ) : (
              <Stack spacing={1}>
                {upcoming.map((a) => (
                  <Card key={a.id} variant="outlined" sx={{ p: 1.25, borderRadius: 3 }}>
                    <Typography sx={{ fontWeight: 600 }}>{appointmentWhen(a)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {a.therapistName ? `Physiotherapy · ${a.therapistName}` : "Physiotherapy session"} · {a.status === "scheduled" ? "Confirmed" : "Awaiting confirmation"}
                    </Typography>
                  </Card>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Box>

        {/* Quick access */}
        <Box sx={{ gridColumn: { md: "span 12" } }}>
          <SectionCard title="Quick access">
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(6, 1fr)" }, gap: 1.5 }}>
              {quick.map((q) => (
                <Card key={q.label} variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardActionArea component={RouterLink} to={q.to} sx={{ p: 1.5, textAlign: "center" }}>
                    <Box sx={{ display: "flex", justifyContent: "center", mb: 0.75 }}>
                      <IconBubble color={q.color}>{q.icon}</IconBubble>
                    </Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{q.label}</Typography>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          </SectionCard>
        </Box>
      </Box>

      <HealthLogDialog open={logOpen} onClose={() => setLogOpen(false)} email={user.email} />
      <ReminderDialog open={remindersOpen} onClose={() => setRemindersOpen(false)} email={user.email} reminders={data?.reminders} />
    </Box>
  );
}

export default PatientDashboard;
