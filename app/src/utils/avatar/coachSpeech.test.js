import { speechText, speechRate, pickVoice, createCoachVoice } from "./coachSpeech";

describe("speechText", () => {
  it("says the degree sign out loud", () => {
    expect(speechText("en", "Raise your legs to 90°")).toBe("Raise your legs to 90 degrees");
    expect(speechText("hi", "पैरों को 90° तक ऊपर उठाएँ")).toContain("नब्बे डिग्री");
  });

  it("spells Hindi numbers as words", () => {
    expect(speechText("hi", "कोहनियाँ 45° पर रखें")).toContain("पैंतालीस डिग्री");
    expect(speechText("hi", "999 बार")).toContain("999"); // no guessed word for an unknown number
  });

  it("leaves English digits alone", () => {
    expect(speechText("en", "Hold for 3 seconds")).toBe("Hold for 3 seconds");
  });

  it("turns dashes into a pause the engine understands", () => {
    expect(speechText("en", "Lower your chest — elbows at 45°")).toBe("Lower your chest, elbows at 45 degrees");
    expect(speechText("hi", "सीधे बैठें, घुटने 90° पर")).toBe("सीधे बैठें, घुटने नब्बे डिग्री पर");
  });

  it("copes with nothing to say", () => {
    expect(speechText("hi", "")).toBe("");
    expect(speechText("hi", undefined)).toBe("");
  });

  it("slows down for Hindi", () => {
    expect(speechRate("hi")).toBeLessThan(speechRate("en"));
  });
});

describe("pickVoice", () => {
  const v = (name, lang, localService = true) => ({ name, lang, localService });

  it("prefers the exact language over a related one", () => {
    const voices = [v("Hindi Generic", "hi"), v("Microsoft Hemant", "hi-IN")];
    expect(pickVoice("hi-IN", voices).name).toBe("Microsoft Hemant");
  });

  it("prefers the most human-sounding voice", () => {
    const voices = [v("Google हिन्दी", "hi-IN", false), v("Microsoft Hemant", "hi-IN"), v("Swara Natural", "hi-IN", false)];
    expect(pickVoice("hi-IN", voices).name).toBe("Swara Natural");
    expect(pickVoice("hi-IN", voices.slice(0, 2)).name).toBe("Google हिन्दी");
  });

  it("finds the best offline voice for the fallback", () => {
    const voices = [v("Google हिन्दी", "hi-IN", false), v("Microsoft Hemant", "hi-IN")];
    expect(pickVoice("hi-IN", voices, "local").name).toBe("Microsoft Hemant");
    expect(pickVoice("hi-IN", [v("Google हिन्दी", "hi-IN", false)], "local")).toBeNull();
  });

  it("falls back to the same base language and copes with underscores", () => {
    expect(pickVoice("hi-IN", [v("Hindi", "hi_IN")]).name).toBe("Hindi");
    expect(pickVoice("hi-IN", [v("US English", "en-US")])).toBeNull();
    expect(pickVoice("hi-IN", [])).toBeNull();
  });
});

describe("the speech queue", () => {
  class FakeUtterance {
    constructor(text) {
      this.text = text;
    }
  }

  const setup = () => {
    const spoken = [];
    const timers = [];
    let clock = 0;
    const synth = { speak: (u) => spoken.push(u), cancel: () => spoken.push("CANCEL") };
    const voice = createCoachVoice({
      synth,
      Utterance: FakeUtterance,
      now: () => clock,
      setTimer: (fn) => timers.push(fn) && timers.length,
      clearTimer: () => {},
    });
    return {
      voice,
      spoken,
      timers,
      tick: (ms) => {
        clock += ms;
      },
      finish: () => spoken.filter((u) => u !== "CANCEL").slice(-1)[0].onend(),
      fail: (error) => spoken.filter((u) => u !== "CANCEL").slice(-1)[0].onerror({ error }),
    };
  };

  it("lets the current line finish instead of cutting it off", () => {
    const { voice, spoken, finish } = setup();
    expect(voice.speak({ text: "पहला वाक्य" })).toBe("speaking");
    expect(voice.speak({ text: "दूसरा वाक्य" })).toBe("queued");
    expect(spoken).toHaveLength(1);
    finish();
    expect(spoken.map((u) => u.text)).toEqual(["पहला वाक्य", "दूसरा वाक्य"]);
  });

  it("keeps only the newest waiting cue", () => {
    const { voice, spoken, finish } = setup();
    voice.speak({ text: "one" });
    voice.speak({ text: "two" });
    voice.speak({ text: "three" });
    finish();
    expect(spoken.map((u) => u.text)).toEqual(["one", "three"]);
  });

  it("drops a cue that went stale while it waited", () => {
    const { voice, spoken, tick, finish } = setup();
    voice.speak({ text: "now" });
    voice.speak({ text: "later" });
    tick(5000);
    finish();
    expect(spoken).toHaveLength(1);
  });

  it("ignores the same line repeated straight away", () => {
    const { voice, tick, finish } = setup();
    voice.speak({ text: "same" });
    finish();
    expect(voice.speak({ text: "same" })).toBe("duplicate");
    tick(2500);
    expect(voice.speak({ text: "same" })).toBe("speaking");
  });

  it("carries the voice, language and rate through", () => {
    const { voice, spoken } = setup();
    const hindi = { name: "Hemant", lang: "hi-IN" };
    voice.speak({ text: "नमस्ते", bcp47: "hi-IN", voice: hindi, rate: 0.9 });
    expect(spoken[0]).toMatchObject({ lang: "hi-IN", voice: hindi, rate: 0.9 });
  });

  it("silences one speaker without cutting off the other", () => {
    const { voice, spoken } = setup();
    voice.speak({ text: "form feedback", source: "feedback" });
    voice.stop("coach");
    expect(spoken).not.toContain("CANCEL");

    voice.speak({ text: "coach cue", source: "coach" });
    voice.stop("coach"); // only the queued coach line goes
    expect(spoken).not.toContain("CANCEL");
  });

  it("stops its own speaker at once", () => {
    const { voice, spoken } = setup();
    voice.speak({ text: "coach cue", source: "coach" });
    voice.stop("coach");
    expect(spoken).toContain("CANCEL");
    expect(voice.busy).toBe(false);
  });

  it("finishes the cue on the offline voice when a streamed one fails", () => {
    const { voice, spoken, fail } = setup();
    const online = { name: "Google हिन्दी" };
    const offline = { name: "Microsoft Hemant" };
    voice.speak({ text: "पैरों को नब्बे डिग्री तक ऊपर उठाएँ", voice: online, fallbackVoice: offline });
    fail("network");
    expect(spoken).toHaveLength(2);
    expect(spoken[1].voice).toBe(offline);

    fail("network"); // only one retry, then it gives up rather than looping
    expect(spoken).toHaveLength(2);
  });

  it("does not retry when the cue was simply interrupted", () => {
    const { voice, spoken, fail } = setup();
    voice.speak({ text: "cue", voice: { name: "a" }, fallbackVoice: { name: "b" } });
    fail("interrupted");
    expect(spoken).toHaveLength(1);
    expect(voice.busy).toBe(false);
  });

  it("does not wedge shut when a browser forgets to report the end", () => {
    const { voice, spoken, timers } = setup();
    voice.speak({ text: "first" });
    voice.speak({ text: "second" });
    timers[timers.length - 1](); // the watchdog fires instead of onend
    expect(spoken.map((u) => u.text)).toEqual(["first", "second"]);
  });
});
