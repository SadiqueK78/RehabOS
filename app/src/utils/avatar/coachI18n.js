/**
 * Translations for the 3D coach: panel labels and the spoken/on-screen exercise cues.
 *
 * Cues are referenced from exerciseMotions.js by id, optionally with a body side:
 *   cue: "squat.stand"            or   cue: ["lunge.step", "left"]
 * `{side}` / `{Side}` in a string is replaced by the translated side word.
 *
 * To add a language: add an entry to LANGUAGES and a matching block in STRINGS.
 */

export const LANGUAGES = [
  { code: "en", label: "English", short: "EN", speech: "en-US" },
  { code: "hi", label: "हिन्दी", short: "हिं", speech: "hi-IN" },
];

const STRINGS = {
  en: {
    side: { left: "left", right: "right" },
    ui: {
      title: "Your Coach",
      reps: "Coach reps: {n}",
      loading: "Loading your coach…",
      unsupported: "Your browser doesn't support 3D graphics (WebGL), so the coach can't be shown.",
      error: "The coach couldn't be loaded. Check your connection and reload the page.",
      recovering: "Restoring the 3D view…",
      play: "Play coach",
      pause: "Pause coach",
      mirrorOn: "Mirrored (like a mirror)",
      mirrorOff: "Not mirrored",
      voiceOn: "Voice cues on",
      voiceOff: "Voice cues off",
      noVoice: "No {lang} voice is installed on this device, so cues are shown as text only.",
      resetView: "Reset view (or double-click the coach)",
      speed: "Coach speed",
      language: "Coach language",
      show: "Show 3D Coach",
      hide: "Hide Coach",
      avatarAdult: "Standard coach",
      avatarSenior: "Senior coach — slower, gentler movements",
      useSenior: "Switch to the senior coach",
      useAdult: "Switch to the standard coach",
      chooseCoach: "Choose your coach",
      adultShort: "Standard",
      seniorShort: "Senior",
    },
    cues: {
      "squat.stand": "Stand tall, feet shoulder-width apart",
      "squat.down": "Sit your hips back and down — chest up",
      "pushUp.up": "Arms straight, body in one line",
      "pushUp.down": "Lower your chest — elbows at 45°",
      "plank.align": "Elbows under shoulders, body in a straight line",
      "plank.brace": "Brace your core and squeeze your glutes",
      "plank.breathe": "Breathe steadily — don't let your hips sag",
      "bridge.down": "Knees bent, feet flat, arms by your sides",
      "bridge.up": "Squeeze your glutes and lift your hips",
      "deadBug.table": "Tabletop: arms up, knees over hips",
      "deadBug.extend": "Extend opposite arm and leg — keep your back flat",
      "legRaise.down": "Lower slowly — keep your legs straight",
      "legRaise.up": "Raise your legs to 90°",
      "pilates.in": "Breathe in — pump your arms",
      "pilates.out": "Breathe out — keep legs at 45°",
      "ler.start": "Elbow at shoulder height, forearm forward",
      "ler.up": "Rotate your forearm up — keep the elbow still",
      "lunge.stand": "Stand tall, hands relaxed",
      "lunge.step": "Step forward with your {side} leg",
      "lunge.down": "Lower until both knees are at 90°",
      "lunge.push": "Push through your front heel",
      "lunge.back": "Push back to standing",
      "pullUp.hang": "Dead hang, hands just wider than shoulders",
      "pullUp.top": "Pull your chest to the bar — chin over",
      "muscleUp.hang": "Hang with a firm false grip",
      "muscleUp.pull": "Explosive pull to your lower chest",
      "muscleUp.lean": "Lean forward over the bar",
      "muscleUp.press": "Press to lockout",
      "muscleUp.lower": "Lower under control, back over the bar to a hang",
      "press.rack": "Hands at shoulders, elbows tucked at 45°",
      "press.up": "Press overhead — don't lock your elbows",
      "rolls.relax": "Relax your shoulders",
      "rolls.up": "Lift your shoulders toward your ears",
      "rolls.back": "Roll them back",
      "rolls.down": "Draw them down",
      "neck.center": "Sit or stand tall, look forward",
      "neck.tilt": "{Side} ear toward {side} shoulder — hold",
      "neck.back": "Back to centre",
      "calf.flat": "Feet hip-width, weight even",
      "calf.up": "Rise onto the balls of your feet — hold",
      "ske.seated": "Sit tall, knees at 90°",
      "ske.extend": "Straighten your {side} knee — hold",
      "wall.lean": "Back flat against the wall",
      "wall.sit": "Slide down until knees are at 90° — hold",
      "toe.stand": "Stand tall, knees straight",
      "toe.fold": "Hinge at the hips and reach for your toes",
      "oblique.stand": "Hands behind head, elbows wide",
      "oblique.crunch": "Drive your {side} knee to your {side} elbow",
      "tree.shift": "Stand tall, shift weight onto your {side} foot",
      "tree.place": "Place your {side} foot on your inner thigh",
      "tree.arms": "Raise your arms overhead — breathe",
      "tree.lower": "Lower your arms slowly",
      "heelSlide.start": "Lie on your back with both legs straight",
      "heelSlide.slide": "Slide your {side} heel toward you, then back out",
      "anklePumps.start": "Lie back with your legs straight and relaxed",
      "anklePumps.up": "Pull your toes up toward you",
      "anklePumps.down": "Now point your toes away",
      "straightLegRaise.start": "Bend one knee, keep the other leg straight",
      "straightLegRaise.lift": "Lift your straight {side} leg to knee height — hold",
      "sitToStand.sit": "Sit near the front of the chair, feet flat",
      "sitToStand.lean": "Lean forward — nose over toes",
      "sitToStand.stand": "Push through your heels and stand tall",
      "sitToStand.down": "Reach back and sit down slowly",
      "seatedMarching.sit": "Sit tall and hold the sides of the chair",
      "seatedMarching.lift": "Lift your {side} knee up, then lower it",
      "armRaise.down": "Stand tall, arms by your sides",
      "armRaise.up": "Raise both arms forward and up",
      "sideArmRaise.up": "Lift your arms out to shoulder height",
      "wallPushUp.start": "Hands flat on the wall at shoulder height",
      "wallPushUp.down": "Bend your elbows — chest toward the wall",
      "wallPushUp.up": "Push back to straight arms",
      "hipAbduction.stand": "Stand tall, weight on your {side} leg",
      "hipAbduction.lift": "Lift your {side} leg out to the side",
      "singleLegBalance.stand": "Stand tall beside a chair for support",
      "singleLegBalance.lift": "Lift your {side} foot and hold steady",
      "singleLegBalance.down": "Lower your foot slowly",
      "miniSquat.stand": "Feet hip-width apart, stand tall",
      "miniSquat.down": "Bend your knees a little — hips back",
      "miniSquat.up": "Stand back up tall",
    },
  },

  hi: {
    side: { left: "बाएँ", right: "दाएँ" },
    ui: {
      title: "आपका कोच",
      reps: "कोच के दोहराव: {n}",
      loading: "आपका कोच लोड हो रहा है…",
      unsupported: "आपका ब्राउज़र 3D ग्राफ़िक्स (WebGL) सपोर्ट नहीं करता, इसलिए कोच नहीं दिखाया जा सकता।",
      error: "कोच लोड नहीं हो सका। अपना इंटरनेट कनेक्शन जाँचें और पेज दोबारा लोड करें।",
      recovering: "3D दृश्य फिर से तैयार हो रहा है…",
      play: "कोच चलाएँ",
      pause: "कोच रोकें",
      mirrorOn: "मिरर मोड चालू (आईने की तरह)",
      mirrorOff: "मिरर मोड बंद",
      voiceOn: "आवाज़ में निर्देश चालू",
      voiceOff: "आवाज़ में निर्देश बंद",
      noVoice: "इस डिवाइस में {lang} आवाज़ इंस्टॉल नहीं है, इसलिए निर्देश केवल लिखकर दिखाए जाएँगे।",
      resetView: "दृश्य रीसेट करें (या कोच पर डबल-क्लिक करें)",
      speed: "कोच की गति",
      language: "कोच की भाषा",
      show: "3D कोच दिखाएँ",
      hide: "कोच छिपाएँ",
      avatarAdult: "सामान्य कोच",
      avatarSenior: "वरिष्ठ कोच — धीमी और सौम्य गतिविधियाँ",
      useSenior: "वरिष्ठ (बुज़ुर्ग) कोच चुनें",
      useAdult: "सामान्य कोच चुनें",
      chooseCoach: "अपना कोच चुनें",
      adultShort: "सामान्य",
      seniorShort: "वरिष्ठ",
    },
    cues: {
      "squat.stand": "सीधे खड़े हों, पैर कंधों जितनी चौड़ाई पर रखें",
      "squat.down": "कूल्हों को पीछे और नीचे ले जाएँ — छाती ऊपर रखें",
      "pushUp.up": "बाँहें सीधी रखें, पूरा शरीर एक सीध में",
      "pushUp.down": "छाती नीचे लाएँ — कोहनियाँ 45° पर रखें",
      "plank.align": "कोहनियाँ कंधों के ठीक नीचे, शरीर एक सीधी रेखा में",
      "plank.brace": "पेट की मांसपेशियों को कसें और नितंबों को सिकोड़ें",
      "plank.breathe": "आराम से साँस लेते रहें — कूल्हों को नीचे न झुकने दें",
      "bridge.down": "घुटने मोड़ें, तलवे ज़मीन पर, बाँहें शरीर के बगल में",
      "bridge.up": "नितंबों को कसें और कूल्हों को ऊपर उठाएँ",
      "deadBug.table": "टेबलटॉप स्थिति: बाँहें ऊपर, घुटने कूल्हों के ठीक ऊपर",
      "deadBug.extend": "विपरीत हाथ और पैर को फैलाएँ — पीठ ज़मीन से सटी रखें",
      "legRaise.down": "धीरे-धीरे नीचे लाएँ — पैर सीधे रखें",
      "legRaise.up": "पैरों को 90° तक ऊपर उठाएँ",
      "pilates.in": "साँस अंदर लें — बाँहों को ऊपर-नीचे चलाएँ",
      "pilates.out": "साँस बाहर छोड़ें — पैर 45° पर टिकाए रखें",
      "ler.start": "कोहनी कंधे की ऊँचाई पर, बाँह का निचला हिस्सा आगे की ओर",
      "ler.up": "बाँह के निचले हिस्से को ऊपर घुमाएँ — कोहनी को स्थिर रखें",
      "lunge.stand": "सीधे खड़े हों, हाथ ढीले छोड़ें",
      "lunge.step": "{side} पैर से एक कदम आगे बढ़ाएँ",
      "lunge.down": "तब तक नीचे जाएँ जब तक दोनों घुटने 90° पर न हों",
      "lunge.push": "आगे वाली एड़ी पर ज़ोर देकर ऊपर आएँ",
      "lunge.back": "वापस सीधे खड़े हो जाएँ",
      "pullUp.hang": "बार से लटकें, हाथ कंधों से थोड़े ज़्यादा चौड़े रखें",
      "pullUp.top": "छाती को बार की ओर खींचें — ठुड्डी बार के ऊपर",
      "muscleUp.hang": "मज़बूत फ़ॉल्स ग्रिप के साथ बार से लटकें",
      "muscleUp.pull": "पूरी ताक़त से खींचें, बार को निचली छाती तक लाएँ",
      "muscleUp.lean": "बार के ऊपर आगे की ओर झुकें",
      "muscleUp.press": "बाँहें पूरी सीधी होने तक ऊपर धकेलें",
      "muscleUp.lower": "नियंत्रण के साथ धीरे-धीरे बार के ऊपर से वापस लटकने की स्थिति में आएँ",
      "press.rack": "हाथ कंधों पर, कोहनियाँ 45° पर अंदर की ओर",
      "press.up": "सिर के ऊपर धकेलें — कोहनियों को पूरी तरह लॉक न करें",
      "rolls.relax": "कंधों को ढीला छोड़ें",
      "rolls.up": "कंधों को कानों की ओर ऊपर उठाएँ",
      "rolls.back": "अब उन्हें पीछे की ओर घुमाएँ",
      "rolls.down": "और धीरे से नीचे लाएँ",
      "neck.center": "सीधे बैठें या खड़े हों, सामने देखें",
      "neck.tilt": "{side} कान को {side} कंधे की ओर झुकाएँ — रुकें",
      "neck.back": "वापस बीच में आएँ",
      "calf.flat": "पैर कूल्हों जितनी चौड़ाई पर, वज़न दोनों पैरों पर बराबर",
      "calf.up": "पंजों के बल ऊपर उठें — रुकें",
      "ske.seated": "सीधे बैठें, घुटने 90° पर",
      "ske.extend": "{side} घुटने को सीधा करें — रुकें",
      "wall.lean": "पीठ को दीवार से सटाकर रखें",
      "wall.sit": "घुटने 90° होने तक नीचे खिसकें — रुकें",
      "toe.stand": "सीधे खड़े हों, घुटने सीधे रखें",
      "toe.fold": "कूल्हों से आगे झुकें और पैरों की उँगलियों को छुएँ",
      "oblique.stand": "हाथ सिर के पीछे, कोहनियाँ बाहर की ओर फैली हुई",
      "oblique.crunch": "{side} घुटने को {side} कोहनी की ओर लाएँ",
      "tree.shift": "सीधे खड़े हों, वज़न {side} पैर पर डालें",
      "tree.place": "{side} पैर का तलवा दूसरी जाँघ के अंदरूनी हिस्से पर रखें",
      "tree.arms": "बाँहें सिर के ऊपर उठाएँ — गहरी साँस लें",
      "tree.lower": "बाँहों को धीरे-धीरे नीचे लाएँ",
      "heelSlide.start": "पीठ के बल लेटें, दोनों पैर सीधे रखें",
      "heelSlide.slide": "{side} एड़ी को ज़मीन पर सरकाते हुए अपनी ओर लाएँ, फिर वापस ले जाएँ",
      "anklePumps.start": "पीठ के बल लेटें, पैर सीधे और ढीले रखें",
      "anklePumps.up": "पंजों को अपनी ओर ऊपर खींचें",
      "anklePumps.down": "अब पंजों को नीचे की ओर तानें",
      "straightLegRaise.start": "एक घुटना मोड़ें, दूसरा पैर सीधा रखें",
      "straightLegRaise.lift": "सीधे {side} पैर को मुड़े घुटने की ऊँचाई तक उठाएँ — रुकें",
      "sitToStand.sit": "कुर्सी के आगे की ओर बैठें, तलवे ज़मीन पर",
      "sitToStand.lean": "आगे झुकें — नाक पंजों के ऊपर",
      "sitToStand.stand": "एड़ियों पर ज़ोर देकर सीधे खड़े हो जाएँ",
      "sitToStand.down": "पीछे हाथ ले जाकर धीरे-धीरे बैठ जाएँ",
      "seatedMarching.sit": "सीधे बैठें और कुर्सी के किनारे पकड़ें",
      "seatedMarching.lift": "{side} घुटने को ऊपर उठाएँ, फिर नीचे रखें",
      "armRaise.down": "सीधे खड़े हों, बाँहें शरीर के बगल में",
      "armRaise.up": "दोनों बाँहों को आगे से ऊपर उठाएँ",
      "sideArmRaise.up": "बाँहों को बगल से कंधे की ऊँचाई तक उठाएँ",
      "wallPushUp.start": "हथेलियाँ कंधे की ऊँचाई पर दीवार पर रखें",
      "wallPushUp.down": "कोहनियाँ मोड़ें — छाती को दीवार की ओर लाएँ",
      "wallPushUp.up": "धकेलकर बाँहें फिर से सीधी करें",
      "hipAbduction.stand": "सीधे खड़े हों, वज़न {side} पैर पर रखें",
      "hipAbduction.lift": "{side} पैर को बगल की ओर उठाएँ",
      "singleLegBalance.stand": "सहारे के लिए कुर्सी के पास सीधे खड़े हों",
      "singleLegBalance.lift": "{side} पैर उठाएँ और संतुलन बनाए रखें",
      "singleLegBalance.down": "पैर धीरे-धीरे नीचे रखें",
      "miniSquat.stand": "पैर कूल्हों की चौड़ाई पर, सीधे खड़े हों",
      "miniSquat.down": "घुटनों को थोड़ा मोड़ें — कूल्हे पीछे",
      "miniSquat.up": "वापस सीधे खड़े हो जाएँ",
    },
  },
};

const fill = (text, vars) =>
  text.replace(/\{(\w+)\}/g, (m, key) => {
    if (key === "Side" && vars.side) return vars.side.charAt(0).toUpperCase() + vars.side.slice(1);
    return vars[key] ?? m;
  });

const pack = (lang) => STRINGS[lang] || STRINGS.en;

/** Panel label, e.g. t("hi", "reps", { n: 3 }). Falls back to English. */
export function t(lang, key, vars = {}) {
  return fill(pack(lang).ui[key] ?? STRINGS.en.ui[key] ?? key, vars);
}

/** Translate a cue reference ("id" or ["id", "left"|"right"]). */
export function cueText(lang, cue) {
  if (!cue) return "";
  const [id, side] = Array.isArray(cue) ? cue : [cue];
  const p = pack(lang);
  const text = p.cues[id] ?? STRINGS.en.cues[id] ?? id;
  return fill(text, { side: side ? p.side[side] : "" });
}

/** Stable key for comparing cue references. */
export const cueKey = (cue) => (Array.isArray(cue) ? cue.join("|") : cue || "");

export const speechLang = (lang) => (LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0]).speech;

export function defaultLang() {
  try {
    const saved = localStorage.getItem("coachLang");
    if (saved && STRINGS[saved]) return saved;
  } catch {
    /* storage unavailable */
  }
  return (navigator.language || "").toLowerCase().startsWith("hi") ? "hi" : "en";
}
