import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import LockIcon from "@mui/icons-material/Lock";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import toast from "react-hot-toast";
import { addHealthLog } from "../../utils/patient/patientData";
import { loadFaceMood, readFrame } from "../../utils/mood/faceMoodDetector";
import { MOOD_FACES, MOOD_LABELS, summariseSamples, happyPoints, moodMessage } from "../../utils/mood/faceMood";

const CAPTURE_MS = 5000;
const NO_FACE_MS = 12000; // after this long without a face, offer the manual way out

/**
 * Mood Mirror: a few seconds in front of the camera instead of filling in a mood field.
 *
 * The webcam frames are read by MediaPipe inside the browser and thrown away immediately - only
 * the resulting mood (1-5) is saved, on the same scale as a manual entry. Checking in earns
 * happy points and keeps the streak alive whatever the mood turns out to be.
 */
function MoodMirror({ open, onClose, email, healthLogs = {}, onSaved }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const samplesRef = useRef([]);
  const startedRef = useRef(0);
  const tsRef = useRef(0);

  const [phase, setPhase] = useState("intro"); // intro | starting | scanning | saving | result | manual | error
  const [error, setError] = useState("");
  const [live, setLive] = useState(null);
  const [faceSeen, setFaceSeen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [stuck, setStuck] = useState(false); // camera on, but no face found for a while

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);
  useEffect(() => {
    if (!open) {
      stopCamera();
      setPhase("intro");
      setLive(null);
      setProgress(0);
      setResult(null);
      setError("");
      setStuck(false);
    }
  }, [open, stopCamera]);

  /** Save the reading and work out what it earned. */
  const record = useCallback(
    async (mood, score, source) => {
      setPhase("saving");
      const at = Date.now();
      const entry = { mood, moodSource: source };
      if (score !== undefined) entry.smileScore = Math.round(score * 100) / 100;
      try {
        await addHealthLog(email, entry);
        const before = happyPoints(healthLogs);
        const after = happyPoints({ ...healthLogs, [String(at)]: { ...entry, at } });
        setResult({ mood, earned: after.points - before.points, points: after.points, streak: after.streak });
        setPhase("result");
        onSaved?.();
      } catch (e) {
        console.error(e);
        toast.error("Could not save your check-in. Please check your connection.");
        setError("Your mood was read, but saving it failed.");
        setPhase("error");
      }
    },
    [email, healthLogs, onSaved]
  );

  const finish = useCallback(() => {
    stopCamera();
    const summary = summariseSamples(samplesRef.current);
    if (!summary) {
      setError("I could not see your face clearly. Try again with a little more light.");
      setPhase("error");
      return;
    }
    record(summary.mood, summary.score, "camera");
  }, [record, stopCamera]);

  const start = useCallback(async () => {
    setPhase("starting");
    setError("");
    samplesRef.current = [];
    startedRef.current = 0;
    setProgress(0);
    setStuck(false);
    const openedAt = performance.now();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      await loadFaceMood();
      for (let i = 0; i < 20 && !videoRef.current; i++) await new Promise((r) => setTimeout(r, 50));
      const video = videoRef.current;
      if (!video) return stopCamera();
      video.srcObject = stream;
      await video.play();
      setPhase("scanning");

      const tick = () => {
        const v = videoRef.current;
        if (!v || !streamRef.current) return;
        const ts = Math.max(performance.now(), tsRef.current + 1);
        tsRef.current = ts;
        const frame = readFrame(v, ts);
        if (frame) {
          setFaceSeen(true);
          setLive(frame);
          if (!startedRef.current) startedRef.current = performance.now();
          samplesRef.current.push(frame.score);
          const p = Math.min(1, (performance.now() - startedRef.current) / CAPTURE_MS);
          setProgress(p);
          if (p >= 1) return finish();
        } else {
          setFaceSeen(false);
          if (!startedRef.current && performance.now() - openedAt > NO_FACE_MS) setStuck(true);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.error(e);
      stopCamera();
      setError(
        e?.name === "NotAllowedError"
          ? "The camera is blocked. Allow camera access in your browser, or pick a face below."
          : "I could not start the camera. You can pick a face below instead."
      );
      setPhase("error");
    }
  }, [finish, stopCamera]);

  const close = () => {
    stopCamera();
    onClose();
  };

  const meterPercent = Math.round((live?.score ?? 0.5) * 100);

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Mood mirror</DialogTitle>
      <DialogContent dividers>
        {phase === "intro" && (
          <Stack spacing={2} alignItems="center" textAlign="center" sx={{ py: 2 }}>
            <Box sx={{ fontSize: 56, lineHeight: 1 }}>🙂</Box>
            <Typography variant="h6">Let the camera read how you feel</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              Look at the camera for five seconds. Smile if you feel like it — and if you do not, that is
              fine too. Checking in is what earns your happy points.
            </Typography>
            <Chip icon={<LockIcon />} variant="outlined" color="success" label="Runs on your device. No photo or video is saved." />
            <Button variant="contained" size="large" startIcon={<CameraAltIcon />} onClick={start}>
              Start camera
            </Button>
            <Button size="small" onClick={() => setPhase("manual")}>
              No camera? Pick a face instead
            </Button>
          </Stack>
        )}

        {(phase === "starting" || phase === "scanning") && (
          <Stack spacing={2} alignItems="center">
            <Box
              sx={{
                position: "relative",
                width: "100%",
                maxWidth: 420,
                aspectRatio: "4 / 3",
                borderRadius: 3,
                overflow: "hidden",
                bgcolor: "black",
              }}
            >
              <video
                ref={videoRef}
                muted
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
              />
              {phase === "starting" && (
                <Stack sx={{ position: "absolute", inset: 0 }} alignItems="center" justifyContent="center" spacing={1}>
                  <CircularProgress sx={{ color: "common.white" }} />
                  <Typography variant="caption" sx={{ color: "common.white" }}>
                    Starting the camera…
                  </Typography>
                </Stack>
              )}
            </Box>

            {phase === "scanning" && (
              <>
                <Typography variant="body2" color={faceSeen ? "text.secondary" : "warning.main"}>
                  {faceSeen ? "Hold still — reading your expression…" : "Move so your face fills the frame"}
                </Typography>
                <Box sx={{ width: "100%", maxWidth: 420 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <span style={{ fontSize: 22 }}>😐</span>
                    <LinearProgress
                      variant="determinate"
                      value={meterPercent}
                      color={meterPercent > 60 ? "success" : "primary"}
                      sx={{ flex: 1, height: 12, borderRadius: 6 }}
                      aria-label="Smile meter"
                    />
                    <span style={{ fontSize: 22 }}>😄</span>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={progress * 100}
                    sx={{ mt: 1.5, height: 6, borderRadius: 3 }}
                    aria-label="Capture progress"
                  />
                </Box>
                {stuck && (
                  <Button
                    size="small"
                    onClick={() => {
                      stopCamera();
                      setPhase("manual");
                    }}>
                    Camera cannot see you? Pick a face instead
                  </Button>
                )}
              </>
            )}
          </Stack>
        )}

        {phase === "saving" && (
          <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Saving your check-in…
            </Typography>
          </Stack>
        )}

        {phase === "result" && result && (
          <Stack spacing={1.5} alignItems="center" textAlign="center" sx={{ py: 2 }}>
            <Box sx={{ fontSize: 64, lineHeight: 1 }}>{MOOD_FACES[result.mood - 1]}</Box>
            <Typography variant="h6">Today you look {MOOD_LABELS[result.mood - 1].toLowerCase()}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              {moodMessage(result.mood, result.streak)}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
              {result.earned > 0 ? (
                <Chip color="success" label={`+${result.earned} happy points`} />
              ) : (
                <Chip variant="outlined" label="Already counted for today" />
              )}
              {result.streak > 0 && (
                <Chip icon={<LocalFireDepartmentIcon />} color="warning" variant="outlined" label={`${result.streak}-day streak`} />
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {result.points} points in total
            </Typography>
          </Stack>
        )}

        {(phase === "error" || phase === "manual") && (
          <Stack spacing={2} alignItems="center" textAlign="center" sx={{ py: 2 }}>
            {error && <Typography color="text.secondary">{error}</Typography>}
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              How are you feeling today?
            </Typography>
            <ToggleButtonGroup exclusive value={null} onChange={(_e, v) => v && record(v, undefined, "manual")} sx={{ flexWrap: "wrap" }}>
              {MOOD_LABELS.map((label, i) => (
                <ToggleButton key={label} value={i + 1} sx={{ px: 1.5, flexDirection: "column", textTransform: "none" }} aria-label={label}>
                  <span style={{ fontSize: 26, lineHeight: 1.1 }}>{MOOD_FACES[i]}</span>
                  <Typography variant="caption">{label}</Typography>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {(phase === "error" || phase === "manual") && (
          <Button onClick={start}>{phase === "manual" ? "Use the camera" : "Try the camera again"}</Button>
        )}
        {phase === "result" && <Button onClick={start}>Check in again</Button>}
        <Button variant={phase === "result" ? "contained" : "text"} onClick={close}>
          {phase === "result" ? "Done" : "Close"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default MoodMirror;
