import React, { useMemo, useState } from "react";
import { Box, Button, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import MoodIcon from "@mui/icons-material/Mood";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import { SectionCard } from "./ui";
import MoodMirror from "./MoodMirror";
import { MOOD_FACES, MOOD_LABELS, moodByDay, moodStreak, happyPoints, happyMeter } from "../../utils/mood/faceMood";

const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Happy meter: the week's mood at a glance, the check-in streak, and the button that opens
 * the camera check-in. The meter moves with how the patient feels; the points and streak
 * reward showing up, so an honest low day never costs anything.
 */
function HappyMeterCard({ email, healthLogs, sx }) {
  const [open, setOpen] = useState(false);

  const { today, meter, points, streak, week } = useMemo(() => {
    const logs = healthLogs || {};
    const byDay = moodByDay(logs);
    // The last seven days, oldest first, so the strip reads left to right.
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { label: d.toLocaleDateString(undefined, { weekday: "narrow" }), mood: byDay[todayKey(d)] };
    });
    return {
      today: byDay[todayKey()],
      meter: happyMeter(logs, 7),
      points: happyPoints(logs).points,
      streak: moodStreak(logs),
      week,
    };
  }, [healthLogs]);

  const fill = meter.percent ?? 0;

  return (
    <SectionCard
      title="Happy meter"
      icon={<MoodIcon />}
      action={
        streak > 0 ? <Chip size="small" icon={<LocalFireDepartmentIcon />} color="warning" variant="outlined" label={`${streak} days`} /> : null
      }
      sx={sx}>
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ fontSize: 40, lineHeight: 1 }}>{today ? MOOD_FACES[today - 1] : "🙂"}</Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>
              {today ? `Today: ${MOOD_LABELS[today - 1]}` : "No check-in yet today"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {meter.average ? `${meter.average} / 5 average this week` : "Check in to start your streak"}
            </Typography>
          </Box>
        </Stack>

        <Box>
          <LinearProgress
            variant="determinate"
            value={fill}
            color={fill >= 60 ? "success" : fill >= 35 ? "primary" : "warning"}
            sx={{ height: 14, borderRadius: 7 }}
            aria-label="Happy meter"
          />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.75 }}>
            <Typography variant="caption" color="text.secondary">
              {meter.percent === null ? "—" : `${meter.percent}% this week`}
            </Typography>
            {meter.change !== null && meter.change !== 0 && (
              <Typography
                variant="caption"
                color={meter.change > 0 ? "success.main" : "warning.main"}
                sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                {meter.change > 0 ? <TrendingUpIcon fontSize="inherit" /> : <TrendingDownIcon fontSize="inherit" />}
                {meter.change > 0 ? "+" : ""}
                {meter.change} vs last week
              </Typography>
            )}
          </Stack>
        </Box>

        <Stack direction="row" justifyContent="space-between" sx={{ px: 0.5, pt: 0.5, width: "100%", maxWidth: 380, alignSelf: "center" }}>
          {week.map((d, i) => (
            <Stack key={i} alignItems="center" spacing={0.25} sx={{ opacity: d.mood ? 1 : 0.4 }}>
              <Box sx={{ fontSize: 22, lineHeight: 1.2 }}>{d.mood ? MOOD_FACES[d.mood - 1] : "·"}</Box>
              <Typography variant="caption" color="text.secondary">
                {d.label}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">
            <strong>{points}</strong> happy points
          </Typography>
          <Button variant={today ? "outlined" : "contained"} startIcon={<CameraAltIcon />} onClick={() => setOpen(true)}>
            {today ? "Check in again" : "Smile check-in"}
          </Button>
        </Stack>
      </Stack>

      <MoodMirror open={open} onClose={() => setOpen(false)} email={email} healthLogs={healthLogs} />
    </SectionCard>
  );
}

export default HappyMeterCard;
