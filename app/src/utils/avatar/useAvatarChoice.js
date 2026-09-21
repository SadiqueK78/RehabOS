import { useEffect, useState } from "react";
import { AVATARS, avatarAvailable } from "./avatars";

const KEY = "coachAvatar";
const EVENT = "rehabos-avatar-change";

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || "adult";
  } catch {
    return "adult";
  }
};

/**
 * The patient's chosen character (standard or senior), shared by the Digital Twin and the
 * exercise coach so the same person appears everywhere. Returns
 * { avatarId, setAvatarId, available, ready }: `available` lists the installed characters and
 * `ready` turns true once that check is done (until then avatarId is the saved preference).
 */
export default function useAvatarChoice() {
  const [avatarId, setState] = useState(read);
  const [available, setAvailable] = useState(["adult"]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onChange = () => setState(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    let cancelled = false;
    Promise.all(AVATARS.map(async (a) => ((await avatarAvailable(a)) ? a.id : null))).then((ids) => {
      if (cancelled) return;
      setAvailable(ids.filter(Boolean));
      setReady(true);
    });
    return () => {
      cancelled = true;
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setAvatarId = (id) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(id));
    } catch {
      /* storage unavailable */
    }
    setState(id);
    window.dispatchEvent(new CustomEvent(EVENT));
  };

  const resolved = !ready || available.includes(avatarId) ? avatarId : "adult";
  return { avatarId: resolved, setAvatarId, available, ready };
}
