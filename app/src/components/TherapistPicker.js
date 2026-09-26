import React, { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Avatar, Box, Button, Card, CardActionArea, Chip, Stack, Typography } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/**
 * Choosing who treats you.
 *
 * Patients who are paying pick their own physiotherapist, for their rehab plan and for live
 * sessions; on the free plan the choice is made for them, and the card says so rather than
 * silently doing nothing. "No preference" stays available on every plan, because a patient who
 * wants the earliest appointment should not have to pick a name to get one.
 */
function TherapistPicker({ value, onChange, allowed = true, label = "Your physiotherapist" }) {
  const [therapists, setTherapists] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "therapists"));
        const rows = [];
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
        if (!cancelled) setTherapists(rows);
      } catch {
        /* not signed in, or rules block the read: fall back to no preference */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!allowed) {
    return (
      <Alert
        severity="info"
        icon={<LockIcon />}
        action={
          <Button component={RouterLink} to="/pricing" size="small">
            See plans
          </Button>
        }
        sx={{ borderRadius: 3 }}>
        Choosing your own physiotherapist comes with the Recover plan. We will assign the first one
        available.
      </Alert>
    );
  }

  if (loaded && therapists.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No physiotherapists have registered yet — your request goes to whoever picks it up first.
      </Typography>
    );
  }

  const options = [{ id: null, name: "No preference", note: "Whoever is free soonest" }, ...therapists];

  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ overflowX: "auto", pb: 1 }}>
        {options.map((t) => {
          const selected = (value || null) === (t.id || null);
          return (
            <Card
              key={t.id || "none"}
              variant="outlined"
              sx={{
                minWidth: 168,
                borderRadius: 3,
                borderColor: selected ? "primary.main" : undefined,
                borderWidth: selected ? 2 : 1,
              }}>
              <CardActionArea
                onClick={() => onChange({ id: t.id || null, name: t.id ? t.name : null })}
                sx={{ p: 1.5 }}>
                <Stack spacing={1} alignItems="center" textAlign="center">
                  <Avatar sx={{ bgcolor: selected ? "primary.main" : "action.selected" }}>
                    {t.id ? initials(t.name) : "?"}
                  </Avatar>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t.id ? t.name : "No preference"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t.specialisation || t.note || "Physiotherapist"}
                  </Typography>
                  {selected && <Chip size="small" color="primary" label="Chosen" />}
                </Stack>
              </CardActionArea>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}

export default TherapistPicker;
