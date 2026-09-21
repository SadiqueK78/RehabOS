import React, { useEffect, useRef, useState } from "react";
import { Box, CircularProgress } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AvatarScene from "../../utils/avatar/AvatarScene";
import { getAvatar } from "../../utils/avatar/avatars";

/**
 * The patient's Digital Twin figure: the chosen character (standard or senior) standing and
 * breathing calmly. `avatarId` selects the character; changing it swaps the figure in place.
 * Nothing loads until `ready` (the chosen character has been confirmed installed).
 * Drag to turn it around.
 */
function TwinViewer({ avatarId = "adult", ready = true, height = 360, minHeight }) {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mountRef.current) return undefined;
    const scene = new AvatarScene(mountRef.current, {
      dark,
      onReady: () => setLoading(false),
      // If a character fails to load, fall back to the standard one.
      onError: () => scene.setAvatar(getAvatar("adult")),
    });
    scene.setExercise("idle");
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !sceneRef.current) return;
    setLoading(true);
    sceneRef.current.setAvatar(getAvatar(avatarId)).then(() => setLoading(false));
  }, [avatarId, ready]);

  useEffect(() => {
    sceneRef.current?.setDark(dark);
  }, [dark]);

  return (
    <Box sx={{ position: "relative", height, minHeight, borderRadius: 3, overflow: "hidden" }}>
      <Box ref={mountRef} sx={{ position: "absolute", inset: 0, cursor: "grab", "&:active": { cursor: "grabbing" } }} />
      {loading && (
        <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <CircularProgress size={28} />
        </Box>
      )}
    </Box>
  );
}

export default TwinViewer;
