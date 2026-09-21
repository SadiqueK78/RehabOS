import React, { lazy, Suspense, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from "recharts";
import FavoriteIcon from "@mui/icons-material/Favorite";
import BloodtypeIcon from "@mui/icons-material/Bloodtype";
import AirIcon from "@mui/icons-material/Air";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  usePatient,
  latestVitals,
  VITALS,
  MOODS,
  bmi,
  insights as buildInsights,
  dailySeries,
  sortedLogs,
  deleteHealthLog,
  mobilityByExercise,
  mobilityChange,
} from "../utils/patient/patientData";
import { SectionCard, StatTile, SignInPrompt } from "../components/patient/ui";
import HealthLogDialog from "../components/patient/HealthLogDialog";
import HappyMeterCard from "../components/patient/HappyMeterCard";
import ProfileDialog from "../components/patient/ProfileDialog";
import TwinPicker, { useTwinChoice } from "../components/patient/TwinPicker";

const TwinViewer = lazy(() => import("../components/patient/TwinViewer"));

const TABS = ["Overview", "Vitals", "Mobility", "Wellbeing"];
const INSIGHT_ICON = {
  good: <CheckCircleIcon color="success" />,
  warning: <WarningAmberIcon color="warning" />,
  info: <InfoOutlinedIcon color="info" />,
};

const when = (at) =>
  new Date(at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Line chart of a daily series; `lines` = [{ key, name, color }] over data rows with those keys. */
function TrendChart({ data, lines, domain, height = 240 }) {
  const theme = useTheme();
  const hasData = data.some((row) => lines.some((l) => row[l.key] !== null && row[l.key] !== undefined));
  if (!hasData)
    return (
      <Box sx={{ height, display: "grid", placeItems: "center" }}>
        <Typography color="text.secondary">No readings in this period yet.</Typography>
      </Box>
    );
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: theme.palette.text.secondary }} />
        <YAxis domain={domain || ["auto", "auto"]} tick={{ fontSize: 12, fill: theme.palette.text.secondary }} />
        <Tooltip contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 }} />
        {lines.map((l) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Merge several daily series into chart rows: [{ label, a, b }]. */
const combine = (seriesByKey) => {
  const keys = Object.keys(seriesByKey);
  return seriesByKey[keys[0]].map((row, i) => {
    const out = { label: row.label };
    for (const k of keys) out[k] = seriesByKey[k][i].value;
    return out;
  });
};

function DigitalTwin() {
  const theme = useTheme();
  const { user, data, loading } = usePatient();
  const [tab, setTab] = useState(0);
  const [logOpen, setLogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [vital, setVital] = useState("heartRate");
  const [days, setDays] = useState(7);
  const twin = useTwinChoice(user, data?.profile);

  const logs = data?.healthLogs;
  const vitals = useMemo(() => latestVitals(logs), [logs]);
  const insightList = useMemo(() => (data ? buildInsights(data) : []), [data]);
  const mobility = useMemo(() => mobilityByExercise(data?.exerciseHistory), [data]);

  if (loading)
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  if (!user) return <SignInPrompt title="Sign in to see your Digital Twin" />;

  const profile = data?.profile || {};
  const b = bmi(profile);
  const attention = insightList.some((i) => i.level === "warning");
  const bp = vitals.bloodPressure;
  const colors = {
    heartRate: theme.palette.error.main,
    systolic: theme.palette.secondary.main,
    diastolic: theme.palette.info.main,
    spo2: theme.palette.success.main,
    temperature: theme.palette.warning.main,
  };

  const vitalChart = {
    heartRate: { lines: [{ key: "heartRate", name: "Heart rate (bpm)", color: colors.heartRate }], domain: [40, 130] },
    bloodPressure: {
      lines: [
        { key: "systolic", name: "Systolic", color: colors.systolic },
        { key: "diastolic", name: "Diastolic", color: colors.diastolic },
      ],
      domain: [50, 180],
    },
    spo2: { lines: [{ key: "spo2", name: "SpO₂ (%)", color: colors.spo2 }], domain: [85, 100] },
    temperature: { lines: [{ key: "temperature", name: "Temperature (°C)", color: colors.temperature }], domain: [35, 40] },
  }[vital];
  const chartData = combine(Object.fromEntries(vitalChart.lines.map((l) => [l.key, dailySeries(logs, l.key, days)])));

  const summaryRows = [
    ["Age", profile.age ? `${profile.age} years` : null],
    ["Height", profile.heightCm ? `${profile.heightCm} cm` : null],
    ["Weight", profile.weightKg ? `${profile.weightKg} kg` : null],
    ["BMI", b ? `${b.value} (${b.category})` : null],
    ["Condition", profile.condition || null],
    ["Area being treated", profile.affectedArea && profile.affectedArea !== "None" ? profile.affectedArea : null],
  ];

  const recentLogs = sortedLogs(logs).reverse().slice(0, 12);

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 1.5, md: 3 }, py: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} sx={{ mb: 2, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: 26, md: 32 } }}>
            My Digital Twin
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 17 }}>
            A living picture of your health, mobility and recovery, updated from your logs and exercise sessions.
          </Typography>
        </Box>
        <Button variant="contained" size="large" startIcon={<AddIcon />} onClick={() => setLogOpen(true)} sx={{ borderRadius: 3, px: 3 }}>
          Log health
        </Button>
      </Stack>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2.5 }}>
        {TABS.map((t) => (
          <Tab key={t} label={t} sx={{ fontWeight: 600, fontSize: 16, textTransform: "none" }} />
        ))}
      </Tabs>

      {tab === 0 && (
        <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", md: "5fr 7fr" } }}>
          <SectionCard>
            <Box sx={{ borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.05) }}>
              <Suspense fallback={<Box sx={{ height: 460 }} />}>
                <TwinViewer avatarId={twin.avatarId} ready={twin.ready} height={460} />
              </Suspense>
            </Box>
            <Stack alignItems="center" spacing={0.5} sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Choose your twin
              </Typography>
              <TwinPicker value={twin.avatarId} onChange={twin.choose} available={twin.available} size="medium" />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, textAlign: "center" }}>
              Drag to turn your twin around. It learns from every reading and exercise session you save.
            </Typography>
          </SectionCard>
          <Stack spacing={2.5}>
            <SectionCard
              title="Health summary"
              action={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={attention ? "Needs attention" : "Stable"} color={attention ? "warning" : "success"} />
                  <IconButton onClick={() => setProfileOpen(true)} aria-label="Edit health profile">
                    <EditIcon />
                  </IconButton>
                </Stack>
              }>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, columnGap: 3, rowGap: 1.25 }}>
                {summaryRows.map(([label, value]) => (
                  <Stack key={label} direction="row" justifyContent="space-between" sx={{ borderBottom: 1, borderColor: "divider", pb: 0.75 }}>
                    <Typography color="text.secondary">{label}</Typography>
                    <Typography sx={{ fontWeight: 600, textAlign: "right" }}>{value || "—"}</Typography>
                  </Stack>
                ))}
              </Box>
              {!profile.age && (
                <Button sx={{ mt: 2 }} variant="outlined" onClick={() => setProfileOpen(true)}>
                  Complete your profile
                </Button>
              )}
            </SectionCard>
            <SectionCard title="Key insights">
              {insightList.length === 0 ? (
                <Typography color="text.secondary">
                  Insights appear once you log a few readings and save exercise sessions. Start with today's health log.
                </Typography>
              ) : (
                <Stack spacing={1.25}>
                  {insightList.map((i) => (
                    <Stack key={i.text} direction="row" spacing={1.25} alignItems="flex-start">
                      {INSIGHT_ICON[i.level]}
                      <Typography>{i.text}</Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                Insights are general guidance from your own readings, not a diagnosis. Always follow your doctor's and physiotherapist's advice.
              </Typography>
            </SectionCard>
          </Stack>
        </Box>
      )}

      {tab === 1 && (
        <Stack spacing={2.5}>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
            <StatTile icon={<FavoriteIcon />} color="error" label="Heart rate" value={vitals.heartRate?.value} unit="bpm"
              status={vitals.heartRate && VITALS.heartRate.classify(vitals.heartRate.value)} sub={vitals.heartRate && when(vitals.heartRate.at)} />
            <StatTile icon={<BloodtypeIcon />} color="secondary" label="Blood pressure" value={bp ? `${bp.value[0]}/${bp.value[1]}` : undefined} unit="mmHg"
              status={bp && VITALS.bloodPressure.classify(bp.value)} sub={bp && when(bp.at)} />
            <StatTile icon={<AirIcon />} color="success" label="Oxygen level" value={vitals.spo2?.value} unit="%"
              status={vitals.spo2 && VITALS.spo2.classify(vitals.spo2.value)} sub={vitals.spo2 && when(vitals.spo2.at)} />
            <StatTile icon={<ThermostatIcon />} color="warning" label="Temperature" value={vitals.temperature?.value} unit="°C"
              status={vitals.temperature && VITALS.temperature.classify(vitals.temperature.value)} sub={vitals.temperature && when(vitals.temperature.at)} />
          </Box>
          <SectionCard
            title="Trends"
            action={
              <ToggleButtonGroup size="small" exclusive value={days} onChange={(_e, v) => v && setDays(v)}>
                <ToggleButton value={7}>7 days</ToggleButton>
                <ToggleButton value={30}>30 days</ToggleButton>
              </ToggleButtonGroup>
            }>
            <ToggleButtonGroup size="small" exclusive value={vital} onChange={(_e, v) => v && setVital(v)} sx={{ mb: 2, flexWrap: "wrap" }}>
              <ToggleButton value="heartRate">Heart rate</ToggleButton>
              <ToggleButton value="bloodPressure">Blood pressure</ToggleButton>
              <ToggleButton value="spo2">Oxygen</ToggleButton>
              <ToggleButton value="temperature">Temperature</ToggleButton>
            </ToggleButtonGroup>
            <TrendChart data={chartData} lines={vitalChart.lines} domain={vitalChart.domain} />
          </SectionCard>
          <SectionCard title="Recent logs">
            {recentLogs.length === 0 ? (
              <Typography color="text.secondary">No logs yet.</Typography>
            ) : (
              <Stack spacing={1}>
                {recentLogs.map((e) => (
                  <Card key={e.at} variant="outlined" sx={{ p: 1.25, borderRadius: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 600 }}>{when(e.at)}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {[
                            e.heartRate && `HR ${e.heartRate}`,
                            e.systolic && `BP ${e.systolic}/${e.diastolic}`,
                            e.spo2 && `SpO₂ ${e.spo2}%`,
                            e.temperature && `${e.temperature}°C`,
                            e.sleepHours !== undefined && `Sleep ${e.sleepHours} h`,
                            e.mood && `Mood: ${MOODS[e.mood - 1]}`,
                            e.pain !== undefined && `Pain ${e.pain}/10${e.painArea && e.painArea !== "None" ? ` (${e.painArea})` : ""}`,
                            e.note,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Typography>
                      </Box>
                      <IconButton aria-label="Delete log" onClick={() => window.confirm("Delete this log?") && deleteHealthLog(user.email, e.at)}>
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Stack>
      )}

      {tab === 2 && (
        <Stack spacing={2.5}>
          <Alert severity="info">
            Mobility is measured by the camera during your exercise sessions: how far the joint moved in each session you save. It
            grows as your range of motion improves.
          </Alert>
          {Object.keys(mobility).length === 0 ? (
            <SectionCard>
              <Typography sx={{ mb: 2 }}>
                No measurements yet. Do an exercise with the camera, press “Stop Feedback”, and save the summary — your range of motion
                appears here.
              </Typography>
              <Button variant="contained" component={RouterLink} to="/catalog">
                Go to exercises
              </Button>
            </SectionCard>
          ) : (
            <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
              {Object.entries(mobility).map(([exercise, points]) => {
                const change = mobilityChange(points);
                const rows = points.map((p) => ({ label: new Date(p.at).toLocaleDateString(undefined, { day: "numeric", month: "short" }), range: p.range }));
                return (
                  <SectionCard
                    key={exercise}
                    title={exercise}
                    action={
                      change !== null && (
                        <Chip color={change >= 0 ? "success" : "warning"} label={`${change >= 0 ? "+" : ""}${change}% range`} />
                      )
                    }>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: -1.5, mb: 1 }}>
                      {points[0].label} movement · best {Math.max(...points.map((p) => p.range))}° · {points.length} session
                      {points.length === 1 ? "" : "s"}
                    </Typography>
                    <TrendChart data={rows} lines={[{ key: "range", name: "Range (°)", color: theme.palette.primary.main }]} height={200} />
                  </SectionCard>
                );
              })}
            </Box>
          )}
        </Stack>
      )}

      {tab === 3 && (
        <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          <HappyMeterCard email={user.email} healthLogs={data?.healthLogs} sx={{ gridColumn: { md: "1 / -1" } }} />
          <SectionCard title="Pain (0–10)">
            <TrendChart data={combine({ pain: dailySeries(logs, "pain", 14) })} lines={[{ key: "pain", name: "Pain", color: theme.palette.error.main }]} domain={[0, 10]} />
            {vitals.pain && (
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Last: {vitals.pain.value}/10{vitals.painArea && vitals.painArea.value !== "None" ? ` in ${vitals.painArea.value.toLowerCase()}` : ""} · {when(vitals.pain.at)}
              </Typography>
            )}
          </SectionCard>
          <SectionCard title="Sleep (hours)">
            {(() => {
              const rows = combine({ sleep: dailySeries(logs, "sleepHours", 14) });
              return rows.some((r) => r.sleep !== null) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={rows} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: theme.palette.text.secondary }} />
                    <YAxis domain={[0, 12]} tick={{ fontSize: 12, fill: theme.palette.text.secondary }} />
                    <Tooltip contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 }} />
                    <Bar dataKey="sleep" name="Sleep (h)" fill={theme.palette.info.main} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ height: 240, display: "grid", placeItems: "center" }}>
                  <Typography color="text.secondary">No sleep logged in the last two weeks.</Typography>
                </Box>
              );
            })()}
          </SectionCard>
          <SectionCard title="Mood" sx={{ gridColumn: { md: "1 / -1" } }}>
            <TrendChart data={combine({ mood: dailySeries(logs, "mood", 14) })} lines={[{ key: "mood", name: "Mood (1–5)", color: theme.palette.warning.main }]} domain={[1, 5]} height={200} />
          </SectionCard>
        </Box>
      )}

      <HealthLogDialog open={logOpen} onClose={() => setLogOpen(false)} email={user.email} />
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} email={user.email} profile={data?.profile} defaultName={user.displayName} />
    </Box>
  );
}

export default DigitalTwin;
