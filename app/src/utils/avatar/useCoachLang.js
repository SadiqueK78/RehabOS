import { useEffect, useState } from "react";
import { defaultLang } from "./coachI18n";

const EVENT = "coachlangchange";

/** Coach language shared by every component on the page and remembered across visits. */
export default function useCoachLang() {
  const [lang, setLangState] = useState(defaultLang);

  useEffect(() => {
    const onChange = (e) => setLangState(e.detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const setLang = (next) => {
    try {
      localStorage.setItem("coachLang", next);
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  };

  return [lang, setLang];
}
