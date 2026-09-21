/**
 * Speaking the coach's cues.
 *
 * Two things make spoken cues sound wrong, and both are handled here:
 *
 *  - Symbols and digits. A speech engine reads "90°" as "ninety" and drops the degree sign
 *    entirely, so `speechText` writes it out in words ("90 degrees" / "90 डिग्री"). Hindi voices
 *    are also happier with number words than with Latin digits, so the numbers the cues actually
 *    use are spelled out.
 *
 *  - Interruptions. The coach changes cue about every two seconds, but a Hindi sentence takes
 *    four or five to say. Cancelling the previous utterance each time chopped every sentence in
 *    half. `createCoachVoice` instead lets the current line finish and keeps only the newest cue
 *    waiting behind it, dropping it if it has gone stale by the time its turn comes.
 */

const DEGREES = { en: " degrees", hi: " डिग्री" };

// Only the numbers the cues actually contain, plus the small counts, since Hindi number words
// are irregular and a wrong one is worse than a digit.
const HI_NUMBERS = {
  0: "शून्य", 1: "एक", 2: "दो", 3: "तीन", 4: "चार", 5: "पाँच", 6: "छह", 7: "सात", 8: "आठ",
  9: "नौ", 10: "दस", 12: "बारह", 15: "पंद्रह", 20: "बीस", 30: "तीस", 45: "पैंतालीस", 60: "साठ",
  90: "नब्बे", 120: "एक सौ बीस", 180: "एक सौ अस्सी",
};

/** Cue text rewritten so a speech engine says it the way a person would read it aloud. */
export function speechText(lang, text) {
  const degrees = DEGREES[lang] || DEGREES.en;
  let out = String(text ?? "")
    .replace(/\s*°/g, degrees)
    .replace(/[—–]/g, ",")
    .replace(/…/g, ",");
  if (lang === "hi") out = out.replace(/\d+/g, (n) => HI_NUMBERS[Number(n)] ?? n);
  return out.replace(/\s+/g, " ").replace(/\s+([,।.])/g, "$1").trim();
}

/** Slightly slower for Hindi, which these cues pack more syllables into. */
export const speechRate = (lang) => (lang === "hi" ? 0.9 : 0.95);

/**
 * Best installed voice for a language tag, or null.
 *
 * `prefer: "quality"` picks the most human-sounding voice - a neural/natural one, then Google's,
 * which for Hindi is far more fluent than the older built-in voices. Those good voices are often
 * streamed from the network, though, so `prefer: "local"` gives the best voice that works
 * offline; it is used as the fallback when a streamed voice fails mid-cue.
 */
export function pickVoice(bcp47, voices = [], prefer = "quality") {
  const tag = bcp47.toLowerCase();
  const base = tag.split("-")[0];
  const norm = (v) => (v.lang || "").replace("_", "-").toLowerCase();
  const natural = (v) => /natural|neural/i.test(v.name);
  const rank =
    prefer === "local"
      ? (v) => (v.localService ? 0 : 1)
      : (v) => (natural(v) ? 0 : /google/i.test(v.name) ? 1 : v.localService ? 2 : 3);
  const best = (list) => list.slice().sort((a, b) => rank(a) - rank(b))[0] || null;
  const pool = (test) => voices.filter((v) => (prefer === "local" ? v.localService : true) && test(v));
  return (
    best(pool((v) => norm(v) === tag)) ||
    best(pool((v) => norm(v) === base || norm(v).startsWith(`${base}-`))) ||
    null
  );
}

/**
 * A small speech queue that never cuts a sentence in half.
 *
 * `speak` either starts talking, or parks the line behind the one being said. Only the newest
 * waiting line is kept, so the coach says what it is doing now rather than working through a
 * backlog, and a line that waited longer than `staleAfter` is dropped instead of being said late.
 */
export function createCoachVoice(options = {}) {
  const {
    synth = typeof window !== "undefined" ? window.speechSynthesis : null,
    Utterance = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null,
    staleAfter = 4000,
    repeatWithin = 2000,
    now = () => Date.now(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = options;

  let speaking = false;
  let current = null;
  let pending = null;
  let lastText = "";
  let lastAt = 0;
  let watchdog = 0;

  const supported = () => !!synth && !!Utterance;

  // Some browsers never fire onend (a known Chrome quirk), which would wedge the queue shut.
  const armWatchdog = (text) => {
    clearTimer(watchdog);
    watchdog = setTimer(finished, Math.min(20000, 120 * text.length + 2000));
  };

  function finished() {
    clearTimer(watchdog);
    watchdog = 0;
    speaking = false;
    current = null;
    if (!pending) return;
    const next = pending;
    pending = null;
    if (now() - next.at <= staleAfter) start(next);
  }

  // A streamed voice can fail part way through a cue; these are the failures worth retrying
  // with the offline voice rather than leaving the patient with half a sentence.
  const RETRYABLE = ["network", "synthesis-failed", "synthesis-unavailable", "audio-busy"];

  function start(item) {
    const u = new Utterance(item.text);
    u.lang = item.bcp47;
    try {
      if (item.voice) u.voice = item.voice;
    } catch {
      // Some browsers reject a voice object that came from a different context; the language
      // tag alone still gets us a reasonable voice.
    }
    u.rate = item.rate;
    u.onend = finished;
    u.onerror = (e) => {
      const retry = item.fallbackVoice && !item.retried && RETRYABLE.includes(e?.error);
      if (!retry) return finished();
      clearTimer(watchdog);
      speaking = false;
      current = null;
      start({ ...item, voice: item.fallbackVoice, retried: true });
    };
    speaking = true;
    current = item;
    lastText = item.text;
    lastAt = now();
    armWatchdog(item.text);
    synth.speak(u);
  }

  return {
    /** Say a line. Returns what happened, which makes the behaviour easy to test. */
    speak({ text, bcp47 = "en-US", rate = 1, voice = null, fallbackVoice = null, source = "coach" }) {
      if (!supported() || !text) return "unsupported";
      if (text === lastText && now() - lastAt < repeatWithin) return "duplicate";
      const item = { text, bcp47, rate, voice, fallbackVoice, source, at: now() };
      if (speaking) {
        pending = item; // the newest cue replaces whatever was waiting
        return "queued";
      }
      start(item);
      return "speaking";
    },
    /**
     * Stop speaking. With a `source`, only that speaker falls silent (turning the coach's voice
     * off should not cut off the exercise feedback halfway through a word).
     */
    stop(source) {
      if (pending && (!source || pending.source === source)) pending = null;
      if (source && current?.source !== source) return; // someone else is talking: leave them be
      clearTimer(watchdog);
      watchdog = 0;
      speaking = false;
      current = null;
      lastText = "";
      synth?.cancel();
    },
    get busy() {
      return speaking;
    },
  };
}

let shared = null;

/**
 * The one queue the whole app speaks through. The coach's cues and the exercise feedback both
 * use the browser's single speech engine, so without this they cancelled each other mid-sentence.
 */
export function sharedVoice() {
  if (!shared) shared = createCoachVoice();
  return shared;
}
