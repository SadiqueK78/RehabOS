import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import toast from "react-hot-toast";
import { addHealthLog } from "../../utils/patient/patientData";

export const PAIN_AREAS = ["None", "Neck", "Shoulder", "Upper back", "Lower back", "Hip", "Knee", "Ankle / Foot", "Elbow / Wrist", "Other"];

// Plausible ranges; anything outside is almost certainly a typo.
const FIELDS = [
  { key: "heartRate", label: "Heart rate", unit: "bpm", min: 30, max: 220, step: 1 },
  { key: "systolic", label: "BP systolic (top)", unit: "mmHg", min: 70, max: 250, step: 1 },
  { key: "diastolic", label: "BP diastolic (bottom)", unit: "mmHg", min: 40, max: 150, step: 1 },
  { key: "spo2", label: "Oxygen (SpO₂)", unit: "%", min: 70, max: 100, step: 1 },
  { key: "temperature", label: "Temperature", unit: "°C", min: 34, max: 42, step: 0.1 },
  { key: "sleepHours", label: "Sleep last night", unit: "hours", min: 0, max: 24, step: 0.5 },
];

/**
 * Quick daily health log: vitals from a home BP monitor / pulse oximeter / thermometer,
 * plus sleep and pain. Every field is optional; only filled ones are saved.
 */
function HealthLogDialog({ open, onClose, email }) {
  const [values, setValues] = useState({});
  const [pain, setPain] = useState(null);
  const [painArea, setPainArea] = useState("None");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const errorFor = (f) => {
    const v = values[f.key];
    if (v === undefined || v === "") return "";
    const n = Number(v);
    return Number.isFinite(n) && n >= f.min && n <= f.max ? "" : `Enter ${f.min}–${f.max}`;
  };
  const bpHalf = !!values.systolic !== !!values.diastolic;
  const hasError = FIELDS.some((f) => errorFor(f)) || bpHalf;
  const hasAnything = FIELDS.some((f) => values[f.key] !== undefined && values[f.key] !== "") || pain !== null || note.trim();

  const reset = () => {
    setValues({});
    setPain(null);
    setPainArea("None");
    setNote("");
  };

  const save = async () => {
    const entry = {};
    for (const f of FIELDS) if (values[f.key] !== undefined && values[f.key] !== "") entry[f.key] = Number(values[f.key]);
    if (pain !== null) {
      entry.pain = pain;
      entry.painArea = painArea;
    }
    if (note.trim()) entry.note = note.trim();
    setSaving(true);
    try {
      await addHealthLog(email, entry);
      toast.success("Health log saved");
      reset();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Could not save. Please check your connection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Log today's health</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Fill in only what you measured. Readings from a home BP monitor, pulse oximeter or thermometer work well.
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          {FIELDS.map((f) => (
            <TextField
              key={f.key}
              label={`${f.label} (${f.unit})`}
              type="number"
              inputProps={{ min: f.min, max: f.max, step: f.step, inputMode: "decimal" }}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              error={!!errorFor(f) || ((f.key === "systolic" || f.key === "diastolic") && bpHalf)}
              helperText={errorFor(f) || ((f.key === "systolic" || f.key === "diastolic") && bpHalf ? "Enter both BP numbers" : " ")}
            />
          ))}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Mood is recorded by the Happy meter check-in on your dashboard — smile at the camera and it is
          logged for you.
        </Typography>

        <Typography sx={{ mt: 3, fontWeight: 600 }}>
          Pain today: {pain === null ? "not recorded" : `${pain} / 10`}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems={{ sm: "center" }}>
          <Slider
            value={pain ?? 0}
            onChange={(_e, v) => setPain(v)}
            min={0}
            max={10}
            step={1}
            marks={[{ value: 0, label: "No pain" }, { value: 5, label: "5" }, { value: 10, label: "Worst" }]}
            valueLabelDisplay="auto"
            sx={{ flex: 1, mx: 3 }}
            aria-label="Pain score"
          />
          <TextField select label="Where?" value={painArea} onChange={(e) => setPainArea(e.target.value)} sx={{ minWidth: 170 }} disabled={pain === null || pain === 0}>
            {PAIN_AREAS.map((a) => (
              <MenuItem key={a} value={a}>
                {a}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <TextField label="Notes (optional)" value={note} onChange={(e) => setNote(e.target.value)} fullWidth multiline minRows={2} sx={{ mt: 3 }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || hasError || !hasAnything}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default HealthLogDialog;
