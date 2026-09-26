import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, Slide, Stack } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import toast from "react-hot-toast";
import { db } from "../firebaseConfig";
import { reminderDue, reminderKey, reminderText, sessionState } from "../utils/sessions/schedule";

const SEEN_KEY = "rehabosSessionReminders";
const TICK_MS = 20000;

const seen = {
  read() {
    try {
      return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    } catch {
      return [];
    }
  },
  add(key) {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen.read().slice(-20), key]));
    } catch {
      /* storage unavailable: the banner still shows, we may just announce twice */
    }
  },
};

/** A desktop notification, for when RehabOS is open but not the tab in front. */
function desktopNotify(text, onClick) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const n = new Notification("RehabOS session", { body: text, tag: "rehabos-session" });
    n.onclick = () => {
      window.focus();
      onClick();
      n.close();
    };
  } catch {
    /* some browsers refuse constructed notifications; the banner still appears */
  }
}

/**
 * Tells both the patient and the therapist when their session is about to start, wherever they
 * are in the app, and gives them the way in.
 *
 * The join link used to live only on the booking page and nothing announced the start, so a
 * session could be running with one person sitting alone in the room. This watches the signed-in
 * person's appointments, re-checks every twenty seconds so the moment arrives on its own, and
 * shows a banner with a Join button, plus a one-off toast and desktop notification.
 *
 * It reaches someone who has RehabOS open in a tab. Reaching a patient whose laptop is shut
 * needs a push service and a server that wakes at the appointment time; this covers the common
 * case, which is having the app open and losing track of the clock.
 */
function SessionReminder() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(null);
  const [mine, setMine] = useState({ patientEmail: [], therapistEmail: [] });
  const [now, setNow] = useState(() => new Date());
  const [dismissed, setDismissed] = useState([]);
  const [canAsk, setCanAsk] = useState(typeof Notification !== "undefined" && Notification.permission === "default");

  useEffect(() => onAuthStateChanged(getAuth(), (u) => setEmail(u?.email || null)), []);

  // The same person may be the patient on one record and the therapist on another.
  useEffect(() => {
    if (!email) {
      setMine({ patientEmail: [], therapistEmail: [] });
      return undefined;
    }
    const watch = (field) =>
      onSnapshot(
        query(collection(db, "appointments"), where(field, "==", email)),
        (snap) => {
          const rows = [];
          snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
          setMine((prev) => ({ ...prev, [field]: rows }));
        },
        () => setMine((prev) => ({ ...prev, [field]: [] }))
      );
    const unsubs = [watch("patientEmail"), watch("therapistEmail")];
    return () => unsubs.forEach((u) => u());
  }, [email]);

  // The clock has to move on its own, or the join moment never arrives for someone who is just
  // sitting on the page.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const next = useMemo(() => {
    const byId = new Map();
    for (const a of [...mine.patientEmail, ...mine.therapistEmail]) byId.set(a.id, a);
    return [...byId.values()].filter((a) => reminderDue(a, now) && !dismissed.includes(reminderKey(a)))[0];
  }, [mine, now, dismissed]);

  const join = useCallback(() => next && navigate(`/session/${next.id}`), [next, navigate]);

  // Announce each session once, even across page changes.
  useEffect(() => {
    if (!next) return;
    const key = reminderKey(next);
    if (seen.read().includes(key)) return;
    seen.add(key);
    const text = reminderText(next, new Date());
    toast.success(text, { duration: 8000, icon: "📹" });
    desktopNotify(text, () => navigate(`/session/${next.id}`));
  }, [next, navigate]);

  if (!next) return null;
  const live = sessionState(next, now).state === "live";

  return (
    <Slide in direction="down">
      <Box sx={{ position: "sticky", top: 0, zIndex: (t) => t.zIndex.appBar + 1, px: { xs: 1, sm: 2 }, pt: 1 }}>
        <Alert
          severity={live ? "success" : "info"}
          icon={<VideocamIcon />}
          onClose={() => setDismissed((d) => [...d, reminderKey(next)])}
          sx={{ alignItems: "center", boxShadow: 3 }}
          action={
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 1 }}>
              {canAsk && (
                <Button
                  size="small"
                  onClick={() => Notification.requestPermission().finally(() => setCanAsk(false))}
                  sx={{ whiteSpace: "nowrap" }}>
                  Notify me
                </Button>
              )}
              <Button size="small" variant="contained" color={live ? "success" : "primary"} onClick={join} sx={{ whiteSpace: "nowrap" }}>
                Join now
              </Button>
            </Stack>
          }>
          {reminderText(next, now)}
        </Alert>
      </Box>
    </Slide>
  );
}

export default SessionReminder;
