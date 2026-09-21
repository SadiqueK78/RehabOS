import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import toast from "react-hot-toast";
import { saveReminders } from "../../utils/patient/patientData";

const TYPES = [
  { value: "medication", label: "Medication" },
  { value: "hydration", label: "Drink water" },
  { value: "custom", label: "Other" },
];

/** Daily reminders (medication, water, anything else) that appear on Today's Plan. */
function ReminderDialog({ open, onClose, email, reminders }) {
  const [list, setList] = useState([]);
  const [draft, setDraft] = useState({ type: "medication", title: "", time: "09:00" });

  useEffect(() => {
    if (open) setList(reminders || []);
  }, [open, reminders]);

  const add = () => {
    const title = draft.title.trim() || (draft.type === "hydration" ? "Drink a glass of water" : "");
    if (!title) return;
    setList((l) => [...l, { ...draft, title, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
    setDraft((d) => ({ ...d, title: "" }));
  };

  const save = async () => {
    try {
      await saveReminders(email, list);
      toast.success("Reminders saved");
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Could not save. Please check your connection.");
    }
  };

  const sorted = [...list].sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Daily reminders</DialogTitle>
      <DialogContent dividers>
        {sorted.length === 0 ? (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            No reminders yet. Add your medicines or water breaks and they will appear on Today's Plan every day.
          </Typography>
        ) : (
          <List dense sx={{ mb: 1 }}>
            {sorted.map((r) => (
              <ListItem
                key={r.id}
                secondaryAction={
                  <IconButton edge="end" aria-label={`Remove ${r.title}`} onClick={() => setList((l) => l.filter((x) => x.id !== r.id))}>
                    <DeleteOutlineIcon />
                  </IconButton>
                }>
                <ListItemText primary={r.title} secondary={`${r.time} · ${TYPES.find((t) => t.value === r.type)?.label || "Other"}`} />
              </ListItem>
            ))}
          </List>
        )}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "flex-start" }}>
          <TextField select label="Type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} sx={{ minWidth: 140 }}>
            {TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={draft.type === "medication" ? "Medicine name & dose" : "Reminder"}
            placeholder={draft.type === "hydration" ? "Drink a glass of water" : ""}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && add()}
            sx={{ flex: 1 }}
          />
          <TextField label="Time" type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} InputLabelProps={{ shrink: true }} />
          <Button variant="outlined" onClick={add} sx={{ height: 56 }}>
            Add
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ReminderDialog;
