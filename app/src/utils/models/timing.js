/**
 * Latency instrumentation for verification test T-002.
 *
 * Measures how long it takes for what the camera saw to reach the patient as corrective
 * feedback, which is the number the requirement is written against. It is off unless someone
 * turns it on, and when off every function here is a no-op:
 *
 *   localStorage.setItem("rehabosTiming", "1")   // then reload and exercise normally
 *   rehabosTimingReport()                        // prints the percentiles in the console
 *
 * Three series are recorded, all measured from the moment the frame was handed to the pose
 * model, so they add up the way the requirement reads:
 *
 *   inference       frame in, landmarks out
 *   toDisplayed     frame in, corrected feedback painted on screen
 *   toSpoken        frame in, the cue handed to the speech engine
 */

const KEY = "rehabosTiming";

let on = null;
let frameT0 = 0;
const series = { inference: [], toDisplayed: [], toSpoken: [] };

export function enabled() {
  if (on === null) {
    try {
      on = localStorage.getItem(KEY) === "1";
    } catch {
      on = false; // storage unavailable: stay off
    }
  }
  return on;
}

/** Called just before the frame goes to the pose model. */
export function frameStart() {
  if (enabled()) frameT0 = performance.now();
}

/** Called as soon as the pose model returns. */
export function inferDone() {
  if (enabled() && frameT0) series.inference.push(performance.now() - frameT0);
}

/** Called after the browser has painted the feedback that this frame produced. */
export function feedbackShown() {
  if (enabled() && frameT0) series.toDisplayed.push(performance.now() - frameT0);
}

/** Called when the spoken cue for this frame is handed to the speech engine. */
export function feedbackSpoken() {
  if (enabled() && frameT0) series.toSpoken.push(performance.now() - frameT0);
}

const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : null);

/** Percentiles per series, in milliseconds, for the run so far. */
export function summary() {
  const out = {};
  for (const [name, values] of Object.entries(series)) {
    const sorted = [...values].sort((a, b) => a - b);
    out[name] = {
      samples: sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      max: sorted.length ? sorted[sorted.length - 1] : null,
    };
  }
  return out;
}

export function reset() {
  for (const k of Object.keys(series)) series[k] = [];
}

if (typeof window !== "undefined") {
  window.rehabosTimingReport = () => {
    const s = summary();
    const round = (v) => (v === null ? "-" : `${Math.round(v)} ms`);
    // eslint-disable-next-line no-console
    console.table(
      Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { samples: v.samples, p50: round(v.p50), p95: round(v.p95), max: round(v.max) }]))
    );
    return s;
  };
  window.rehabosTimingReset = reset;
}
