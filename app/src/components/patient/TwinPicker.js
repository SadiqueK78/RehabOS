import React, { useEffect, useRef } from "react";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import ElderlyIcon from "@mui/icons-material/Elderly";
import useAvatarChoice from "../../utils/avatar/useAvatarChoice";
import { saveProfile } from "../../utils/patient/patientData";

/**
 * The patient's twin choice. Follows the choice saved on their profile (so it carries across
 * devices) and saves new choices back to it; also sets the exercise coach to the same person.
 */
export function useTwinChoice(user, profile) {
  const choice = useAvatarChoice();
  const saved = profile?.twinAvatar;
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current || !saved || !choice.ready) return;
    synced.current = true;
    if (saved !== choice.avatarId && choice.available.includes(saved)) choice.setAvatarId(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, choice.ready]);

  const choose = (id) => {
    choice.setAvatarId(id);
    if (user) saveProfile(user.email, { twinAvatar: id }).catch((e) => console.error("twin choice:", e));
  };

  return { ...choice, choose };
}

/** "Standard | Senior" switch; hidden when only one character is installed. */
function TwinPicker({ value, onChange, available, size = "small", sx }) {
  if (!available.includes("senior")) return null;
  const btn = { px: 1.5, gap: 0.75, textTransform: "none", fontWeight: 600 };
  return (
    <ToggleButtonGroup
      exclusive
      size={size}
      value={value}
      onChange={(_e, v) => v && v !== value && onChange(v)}
      aria-label="Choose your digital twin"
      sx={sx}>
      <ToggleButton value="adult" sx={btn} title="Standard twin">
        <PersonIcon fontSize="small" />
        Standard
      </ToggleButton>
      <ToggleButton value="senior" sx={btn} title="Senior twin">
        <ElderlyIcon fontSize="small" />
        Senior
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

export default TwinPicker;
