import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import FlipIcon from "@mui/icons-material/Flip";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import VoiceOverOffIcon from "@mui/icons-material/VoiceOverOff";
import ElderlyIcon from "@mui/icons-material/Elderly";
import PersonIcon from "@mui/icons-material/Person";
import AvatarScene from "../utils/avatar/AvatarScene";
import { LANGUAGES, cueText, speechLang, t } from "../utils/avatar/coachI18n";
import useCoachLang from "../utils/avatar/useCoachLang";
import { AVATARS, avatarAvailable, getAvatar } from "../utils/avatar/avatars";

const SPEEDS = [0.5, 0.75, 1, 1.25];
const DEVANAGARI_FONT = '"Noto Sans Devanagari", Poppins, "Nirmala UI", Mangal, sans-serif';

const readPref = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
};
const writePref = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};

const webglAvailable = () => {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
};

/** Best installed voice for a BCP-47 language (e.g. "hi-IN"), or null if the device has none. */
function findVoice(bcp47) {
  const voices = window.speechSynthesis?.getVoices() || [];
  const base = bcp47.split("-")[0];
  return (
    voices.find((v) => v.lang === bcp47 && /google|natural|online/i.test(v.name)) ||
    voices.find((v) => v.lang === bcp47) ||
    voices.find((v) => v.lang.replace("_", "-").toLowerCase().startsWith(base)) ||
    null
  );
}

/**
 * AvatarCoach - a 3D human coach that performs the selected exercise with correct form,
 * shown side by side with the user's webcam feed. Cues are shown (and optionally spoken)
 * in the chosen language.
 *
 * @component
 * @param {string} exerciseKey - exercise identifier (e.g. "squat", "pushUp")
 * @param {number} syncKey - changing this restarts the coach from the first rep (e.g. when feedback starts)
 * @returns {JSX.Element} Coach panel with 3D view, live cue, rep counter and playback controls
 */
function AvatarCoach({ exerciseKey, syncKey = 0 }) {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [lang, setLang] = useCoachLang();
  const langRef = useRef(lang);
  const voiceRef = useRef(readPref("coachVoice", false));

  const [status, setStatus] = useState(webglAvailable() ? "loading" : "unsupported");
  const [contextLost, setContextLost] = useState(false);
  const [cue, setCue] = useState(null);
  const [reps, setReps] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(readPref("coachSpeed", 1));
  const [mirror, setMirror] = useState(readPref("coachMirror", true));
  const [voice, setVoice] = useState(voiceRef.current);
  const [voiceMissing, setVoiceMissing] = useState(false);
  const [avatarId, setAvatarId] = useState(readPref("coachAvatar", "adult"));
  const [available, setAvailable] = useState(["adult"]);
  const avatarRef = useRef(avatarId);

  const speak = (cueRef) => {
    if (!voiceRef.current || !cueRef || !window.speechSynthesis) return;
    const bcp47 = speechLang(langRef.current);
    const v = findVoice(bcp47);
    setVoiceMissing(!v && langRef.current !== "en");
    if (!v && langRef.current !== "en") return; // an English voice would mangle Hindi text
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(cueText(langRef.current, cueRef).replace(/—/g, ","));
    u.lang = bcp47;
    if (v) u.voice = v;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };
  const speakRef = useRef(speak);
  speakRef.current = speak;

  // Create the 3D scene once; it is reused across exercise changes.
  useEffect(() => {
    if (status === "unsupported" || !mountRef.current) return undefined;
    const scene = new AvatarScene(mountRef.current, {
      modelUrl: `${process.env.PUBLIC_URL || ""}/models/coach.glb`,
      dark,
      onCue: (c) => {
        setCue(c);
        speakRef.current(c);
      },
      onRep: (n) => setReps((r) => r + n),
      onReady: () => setStatus("ready"),
      onError: () => {
        // A missing or broken optional character falls back to the standard coach.
        if (avatarRef.current !== "adult") selectAvatar("adult");
        else setStatus("error");
      },
      onContextChange: (lost) => setContextLost(lost),
    });
    scene.setInsets(80, 108);
    scene.setMirror(mirror);
    scene.setSpeed(speed);
    scene.setExercise(exerciseKey);
    sceneRef.current = scene;

    // Only offer characters whose model file is installed, then load the preferred one.
    let cancelled = false;
    Promise.all(AVATARS.map(async (a) => ((await avatarAvailable(a)) ? a.id : null))).then((ids) => {
      if (cancelled) return;
      const ok = ids.filter(Boolean);
      setAvailable(ok);
      const chosen = getAvatar(ok.includes(avatarRef.current) ? avatarRef.current : "adult");
      avatarRef.current = chosen.id;
      setAvatarId(chosen.id);
      scene.setAvatar(chosen);
    });
    return () => {
      cancelled = true;
      window.speechSynthesis?.cancel();
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef.current?.setExercise(exerciseKey);
    setReps(0);
  }, [exerciseKey]);

  useEffect(() => {
    sceneRef.current?.setDark(dark);
  }, [dark]);

  useEffect(() => {
    if (!syncKey) return;
    sceneRef.current?.restart();
    setReps(0);
  }, [syncKey]);

  // Voices load asynchronously in Chrome; re-check availability once they arrive.
  useEffect(() => {
    langRef.current = lang;
    window.speechSynthesis?.cancel();
    const check = () => setVoiceMissing(voiceRef.current && lang !== "en" && !findVoice(speechLang(lang)));
    check();
    window.speechSynthesis?.addEventListener?.("voiceschanged", check);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", check);
  }, [lang, voice]);

  const selectAvatar = (id) => {
    const avatar = getAvatar(id);
    avatarRef.current = avatar.id;
    setAvatarId(avatar.id);
    writePref("coachAvatar", avatar.id);
    // Each character has its own comfortable default pace (the senior coach moves slower).
    setSpeed(avatar.speed);
    writePref("coachSpeed", avatar.speed);
    sceneRef.current?.setSpeed(avatar.speed);
    setReps(0);
    setStatus("loading");
    sceneRef.current?.setAvatar(avatar);
  };

  const togglePlay = () => {
    const next = !playing;
    setPlaying(next);
    sceneRef.current?.setPlaying(next);
    if (!next) window.speechSynthesis?.cancel();
  };

  const changeSpeed = (_e, value) => {
    if (!value) return;
    setSpeed(value);
    writePref("coachSpeed", value);
    sceneRef.current?.setSpeed(value);
  };

  const toggleMirror = () => {
    const next = !mirror;
    setMirror(next);
    writePref("coachMirror", next);
    sceneRef.current?.setMirror(next);
  };

  const toggleVoice = () => {
    const next = !voice;
    setVoice(next);
    voiceRef.current = next;
    writePref("coachVoice", next);
    if (next) speak(cue);
    else window.speechSynthesis?.cancel();
  };

  const border = dark ? "#2b2f3a" : "#d5d9e0";
  const glass = dark ? "rgba(10,12,16,0.72)" : "rgba(255,255,255,0.85)";
  const langName = LANGUAGES.find((l) => l.code === lang)?.label || lang;

  return (
    <Box
      lang={lang}
      sx={{
        position: "relative",
        width: "min(420px, 100%)",
        aspectRatio: "3 / 4",
        maxHeight: "72vh",
        my: "1.25rem",
        borderRadius: "1rem",
        overflow: "hidden",
        border: `6px solid ${border}`,
        bgcolor: dark ? "#16181d" : "#eef0f4",
        flexShrink: 0,
        ...(lang === "hi" && { "& .MuiTypography-root, & .MuiToggleButton-root": { fontFamily: DEVANAGARI_FONT } }),
      }}>
      <Box ref={mountRef} sx={{ position: "absolute", inset: 0, cursor: "grab", "&:active": { cursor: "grabbing" } }} />

      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        sx={{ position: "absolute", top: 0, left: 0, right: 0, px: 1.5, py: 1, pointerEvents: "none" }}>
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, letterSpacing: lang === "hi" ? 0 : 1.2, lineHeight: 1.4, color: dark ? "#c5cae9" : "#e65100" }}>
          {t(lang, "title")}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={lang}
            onChange={(_e, v) => v && setLang(v)}
            aria-label={t(lang, "language")}
            sx={{ pointerEvents: "auto", bgcolor: glass, borderRadius: 2 }}>
            {LANGUAGES.map((l) => (
              <ToggleButton
                key={l.code}
                value={l.code}
                lang={l.code}
                title={l.label}
                sx={{ px: 1, py: 0.1, fontSize: 12, border: 0, textTransform: "none" }}>
                {l.short}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Box sx={{ px: 1.25, py: 0.25, borderRadius: 2, bgcolor: glass, fontVariantNumeric: "tabular-nums" }}>
            <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
              {t(lang, "reps", { n: reps })}
            </Typography>
          </Box>
        </Stack>
      </Stack>

      {/* Coach choice: shown once the senior model is confirmed to be installed */}
      {available.includes("senior") && (
        <ToggleButtonGroup
          size="small"
          exclusive
          value={avatarId}
          onChange={(_e, v) => v && v !== avatarId && selectAvatar(v)}
          aria-label={t(lang, "chooseCoach")}
          sx={{ position: "absolute", top: 40, left: 12, bgcolor: glass, borderRadius: 2, zIndex: 1 }}>
          <ToggleButton value="adult" title={t(lang, "avatarAdult")} sx={{ px: 1.25, py: 0.25, gap: 0.5, border: 0, textTransform: "none", fontSize: 13 }}>
            <PersonIcon fontSize="small" />
            {t(lang, "adultShort")}
          </ToggleButton>
          <ToggleButton value="senior" title={t(lang, "avatarSenior")} sx={{ px: 1.25, py: 0.25, gap: 0.5, border: 0, textTransform: "none", fontSize: 13 }}>
            <ElderlyIcon fontSize="small" />
            {t(lang, "seniorShort")}
          </ToggleButton>
        </ToggleButtonGroup>
      )}

      {(status === "loading" || contextLost) && (
        <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ position: "absolute", inset: 0 }}>
          <CircularProgress size={32} />
          <Typography variant="body2">{t(lang, contextLost ? "recovering" : "loading")}</Typography>
        </Stack>
      )}
      {(status === "error" || status === "unsupported") && (
        <Stack alignItems="center" justifyContent="center" sx={{ position: "absolute", inset: 0, p: 3, textAlign: "center" }}>
          <Typography variant="body2">{t(lang, status)}</Typography>
        </Stack>
      )}

      {/* Cue + controls */}
      {status === "ready" && (
        <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 0, p: 1.25 }}>
          <Box
            aria-live="polite"
            sx={{
              mb: 1,
              px: 1.5,
              py: 1,
              borderRadius: 2,
              bgcolor: glass,
              backdropFilter: "blur(4px)",
              minHeight: "2.75rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}>
            <Typography variant="body1" sx={{ fontWeight: 600, textAlign: "center", lineHeight: 1.35 }}>
              {cueText(lang, cue)}
            </Typography>
            {voice && voiceMissing && (
              <Typography variant="caption" sx={{ opacity: 0.75, textAlign: "center", mt: 0.25 }}>
                {t(lang, "noVoice", { lang: langName })}
              </Typography>
            )}
          </Box>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 0.5, borderRadius: 2, bgcolor: dark ? "rgba(10,12,16,0.55)" : "rgba(255,255,255,0.7)" }}>
            <Stack direction="row">
              <Tooltip title={t(lang, playing ? "pause" : "play")}>
                <IconButton size="small" onClick={togglePlay} aria-label={t(lang, playing ? "pause" : "play")}>
                  {playing ? <PauseIcon /> : <PlayArrowIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title={t(lang, mirror ? "mirrorOn" : "mirrorOff")}>
                <IconButton size="small" onClick={toggleMirror} color={mirror ? "primary" : "default"} aria-label={t(lang, mirror ? "mirrorOn" : "mirrorOff")}>
                  <FlipIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={t(lang, voice ? "voiceOn" : "voiceOff")}>
                <IconButton size="small" onClick={toggleVoice} color={voice ? "primary" : "default"} aria-label={t(lang, voice ? "voiceOn" : "voiceOff")}>
                  {voice ? <RecordVoiceOverIcon /> : <VoiceOverOffIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title={t(lang, "resetView")}>
                <IconButton size="small" onClick={() => sceneRef.current?.frame()} aria-label={t(lang, "resetView")}>
                  <CenterFocusStrongIcon />
                </IconButton>
              </Tooltip>
            </Stack>
            <ToggleButtonGroup size="small" exclusive value={speed} onChange={changeSpeed} aria-label={t(lang, "speed")}>
              {SPEEDS.map((s) => (
                <ToggleButton key={s} value={s} sx={{ px: 0.9, py: 0.25, fontSize: 12, border: 0 }}>
                  {s}×
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
        </Box>
      )}
    </Box>
  );
}

export default AvatarCoach;
