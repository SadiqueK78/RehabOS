import React, { useEffect, useState } from "react";
import { Box, Button, Card, Chip, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { signInWithPopup } from "firebase/auth";
import { auth, db, provider } from "../../firebaseConfig";
import { STATUS_COLOR } from "../../utils/patient/patientData";
import { useDemo, startDemo } from "../../utils/patient/demoPatient";

/** Rounded card with a title row and optional action on the right. */
export function SectionCard({ title, icon, action, children, sx }) {
  return (
    <Card variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 4, height: "100%", ...sx }}>
      {(title || action) && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, gap: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            {icon && <IconBubble color="primary">{icon}</IconBubble>}
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: 18, md: 20 } }}>
              {title}
            </Typography>
          </Stack>
          {action}
        </Stack>
      )}
      {children}
    </Card>
  );
}

/** Soft coloured circle behind an icon. `color` is a theme palette key. */
export function IconBubble({ color = "primary", size = 40, children }) {
  const theme = useTheme();
  const c = theme.palette[color]?.main || color;
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        color: c,
        bgcolor: alpha(c, theme.palette.mode === "dark" ? 0.22 : 0.12),
      }}>
      {children}
    </Box>
  );
}

/** A single reading: label, big value with unit, optional status chip and sub-text. */
export function StatTile({ icon, color = "primary", label, value, unit, status, sub }) {
  return (
    <Card variant="outlined" sx={{ p: 1.75, borderRadius: 3, height: "100%" }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <IconBubble color={color}>{icon}</IconBubble>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" noWrap>
            {label}
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.25 }}>
            {value ?? "—"}
            {value !== undefined && value !== null && unit && (
              <Typography component="span" sx={{ fontSize: 13, ml: 0.5, color: "text.secondary", fontWeight: 500 }}>
                {unit}
              </Typography>
            )}
          </Typography>
          {status && (
            <Chip size="small" label={status[0].toUpperCase() + status.slice(1)} color={STATUS_COLOR[status] || "default"} variant="outlined" sx={{ mt: 0.5, height: 22 }} />
          )}
          {sub && (
            <Typography variant="caption" color="text.secondary" display="block">
              {sub}
            </Typography>
          )}
        </Box>
      </Stack>
    </Card>
  );
}

/** Shown on patient pages when nobody is signed in. */
export function SignInPrompt({ title = "Sign in to see your recovery dashboard" }) {
  return (
    <Box sx={{ maxWidth: 520, mx: "auto", my: 8, textAlign: "center", px: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1.5 }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Your plan, health logs and progress are saved to your account so you and your physiotherapist can follow your recovery.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="center">
        <Button variant="contained" size="large" onClick={() => signInWithPopup(auth, provider).catch(() => {})}>
          Sign in with Google
        </Button>
        <Button variant="outlined" size="large" onClick={startDemo}>
          Try demo patient
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        The demo patient is Ramesh, 72, six weeks after a knee replacement. Demo data stays in this browser only.
      </Typography>
    </Box>
  );
}

/** Live list of the patient's appointments (all statuses), newest first. */
export function usePatientAppointments(email) {
  const demo = useDemo();
  const [appointments, setAppointments] = useState([]);
  useEffect(() => {
    if (!email || demo.active) return undefined;
    const q = query(collection(db, "appointments"), where("patientEmail", "==", email));
    return onSnapshot(
      q,
      (snap) => setAppointments(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))),
      (err) => console.error("appointments:", err)
    );
  }, [email, demo.active]);
  return demo.active ? demo.data?.appointments || [] : appointments;
}

/** "10 Sep, 2:30 pm" style label for an appointment's scheduled or preferred slot. */
export function appointmentWhen(a) {
  const date = a.scheduledDate || a.preferredDate;
  const time = a.scheduledTime || a.preferredTime;
  if (!date) return "Date to be confirmed";
  const d = new Date(`${date}T${time || "09:00"}`);
  if (Number.isNaN(d.getTime())) return [date, time].filter(Boolean).join(" ");
  const day = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return time ? `${day}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : day;
}
