import React, { useEffect, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from "@mui/material";
import toast from "react-hot-toast";
import { saveProfile } from "../../utils/patient/patientData";
import { PAIN_AREAS } from "./HealthLogDialog";

const NUMERIC = [
  { key: "age", label: "Age (years)", min: 1, max: 120 },
  { key: "heightCm", label: "Height (cm)", min: 50, max: 250 },
  { key: "weightKg", label: "Weight (kg)", min: 10, max: 300 },
];

/** Basic health profile shown on the Digital Twin (age, height, weight, condition). */
function ProfileDialog({ open, onClose, email, profile, defaultName }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ name: defaultName || "", sex: "", condition: "", affectedArea: "None", ...(profile || {}) });
  }, [open, profile, defaultName]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const bad = (f) => form[f.key] !== undefined && form[f.key] !== "" && !(Number(form[f.key]) >= f.min && Number(form[f.key]) <= f.max);
  const invalid = NUMERIC.some(bad);

  const save = async () => {
    const out = { ...form };
    for (const f of NUMERIC) out[f.key] = out[f.key] === "" || out[f.key] === undefined ? null : Number(out[f.key]);
    setSaving(true);
    try {
      await saveProfile(email, out);
      toast.success("Profile saved");
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
      <DialogTitle sx={{ fontWeight: 700 }}>Your health profile</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <TextField label="Name" value={form.name || ""} onChange={set("name")} />
          <TextField select label="Sex" value={form.sex || ""} onChange={set("sex")}>
            {["", "Female", "Male", "Other"].map((s) => (
              <MenuItem key={s} value={s}>
                {s || "Prefer not to say"}
              </MenuItem>
            ))}
          </TextField>
          {NUMERIC.map((f) => (
            <TextField
              key={f.key}
              label={f.label}
              type="number"
              value={form[f.key] ?? ""}
              onChange={set(f.key)}
              error={bad(f)}
              helperText={bad(f) ? `Enter ${f.min}–${f.max}` : " "}
            />
          ))}
          <TextField select label="Main area being treated" value={form.affectedArea || "None"} onChange={set("affectedArea")}>
            {PAIN_AREAS.map((a) => (
              <MenuItem key={a} value={a}>
                {a === "None" ? "Not specified" : a}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Condition / reason for rehab"
            placeholder="e.g. knee replacement, stroke recovery, back pain"
            value={form.condition || ""}
            onChange={set("condition")}
            sx={{ gridColumn: { sm: "1 / -1" } }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || invalid}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ProfileDialog;
