import content from "../../assets/content.json";

/**
 * Comprehensive injury-to-exercise mapping.
 * Keys are keywords/phrases found in injury descriptions.
 * Values are exercise IDs available in the app.
 */
const injuryKeywordMap = {
  // Neck & Shoulder
  "neck pain": ["shoulderRolls", "shoulderPress"],
  "neck stiffness": ["shoulderRolls"],
  "neck strain": ["shoulderRolls"],
  "cervical": ["shoulderRolls", "shoulderPress"],
  "shoulder pain": ["shoulderRolls", "shoulderPress", "lateralExternalRotation"],
  "shoulder stiffness": ["shoulderRolls", "lateralExternalRotation"],
  "shoulder impingement": ["lateralExternalRotation", "shoulderRolls"],
  "rotator cuff": ["lateralExternalRotation", "shoulderRolls"],
  "frozen shoulder": ["shoulderRolls", "lateralExternalRotation", "shoulderPress"],
  "shoulder injury": ["shoulderRolls", "lateralExternalRotation"],
  "shoulder dislocation": ["shoulderRolls", "lateralExternalRotation"],

  // Back
  "lower back pain": ["bridge", "deadBug", "plank"],
  "back pain": ["bridge", "deadBug", "plank"],
  "lumbar": ["bridge", "deadBug", "plank"],
  "herniated disc": ["bridge", "deadBug"],
  "sciatica": ["bridge", "deadBug", "legRaise"],
  "spinal": ["bridge", "plank", "deadBug"],
  "spondylitis": ["bridge", "plank"],
  "back strain": ["bridge", "deadBug"],
  "upper back pain": ["shoulderRolls", "plank", "shoulderPress"],
  "thoracic": ["shoulderRolls", "plank"],
  "postural kyphosis": ["plank", "shoulderRolls", "shoulderPress"],

  // Knee & Leg
  "knee pain": ["legRaise", "squat", "bridge"],
  "knee injury": ["legRaise", "squat"],
  "acl": ["legRaise", "squat", "bridge"],
  "mcl": ["legRaise", "squat"],
  "meniscus": ["legRaise", "squat"],
  "patella": ["legRaise", "squat"],
  "knee replacement": ["legRaise", "squat"],
  "knee stiffness": ["squat", "legRaise", "lunge"],
  "leg weakness": ["squat", "lunge", "legRaise"],
  "leg pain": ["legRaise", "squat", "lunge"],
  "hip pain": ["bridge", "legRaise", "lunge"],
  "hip replacement": ["bridge", "legRaise"],
  "hip flexor": ["legRaise", "deadBug", "lunge"],
  "ankle": ["squat", "lunge", "treePose"],
  "calf": ["squat", "lunge"],
  "hamstring": ["toeTouch", "lunge", "bridge"],
  "quadriceps": ["squat", "lunge", "legRaise"],
  "groin": ["legRaise", "bridge"],

  // Core & Abdominal
  "core weakness": ["plank", "deadBug", "pilatesHundred"],
  "abdominal": ["plank", "deadBug", "pilatesHundred", "standingObliqueCrunch"],
  "abs": ["plank", "deadBug", "pilatesHundred"],
  "oblique": ["standingObliqueCrunch", "plank"],
  "hernia": ["plank", "deadBug"],
  "diastasis recti": ["deadBug", "plank"],

  // Posture & Balance
  "posture": ["plank", "shoulderRolls", "shoulderPress", "treePose"],
  "balance": ["treePose", "lunge", "squat"],
  "stability": ["plank", "treePose", "bridge"],
  "coordination": ["lunge", "treePose", "deadBug"],

  // Upper body general
  "upper body": ["pushUp", "shoulderPress", "pullUp"],
  "arm weakness": ["pushUp", "shoulderPress", "pullUp"],
  "chest": ["pushUp"],
  "triceps": ["pushUp", "shoulderPress"],
  "biceps": ["pullUp"],
  "wrist": ["pushUp", "plank"],
  "elbow": ["shoulderPress", "lateralExternalRotation"],
  "tennis elbow": ["lateralExternalRotation", "shoulderRolls"],

  // Flexibility
  "flexibility": ["toeTouch", "lunge", "treePose"],
  "stiffness": ["toeTouch", "shoulderRolls", "lunge"],
  "range of motion": ["shoulderRolls", "lateralExternalRotation", "toeTouch"],
  "mobility": ["toeTouch", "shoulderRolls", "lunge", "treePose"],

  // Post-surgery / General rehab
  "post surgery": ["bridge", "legRaise", "deadBug", "shoulderRolls"],
  "post operative": ["bridge", "legRaise", "deadBug"],
  "rehabilitation": ["bridge", "deadBug", "plank", "legRaise"],
  "recovery": ["bridge", "deadBug", "shoulderRolls", "legRaise"],
  "physiotherapy": ["bridge", "deadBug", "plank", "shoulderRolls"],
  "physical therapy": ["bridge", "deadBug", "plank", "shoulderRolls"],

  // Muscle groups
  "glutes": ["bridge", "squat", "lunge"],
  "deltoid": ["shoulderPress", "lateralExternalRotation"],
  "lat": ["pullUp"],
};

/**
 * Recommended plan parameters for each exercise.
 * reps: target repetitions per set, sets: number of sets,
 * holdSeconds: hold duration (for static exercises),
 * frequencyPerWeek: recommended sessions per week,
 * difficulty: beginner / intermediate / advanced
 */
const exercisePlanDefaults = {
  squat:                   { reps: 12, sets: 3, holdSeconds: 0,  frequencyPerWeek: 4, difficulty: "beginner",     muscleGroup: "Legs & Glutes" },
  pushUp:                  { reps: 10, sets: 3, holdSeconds: 0,  frequencyPerWeek: 3, difficulty: "intermediate", muscleGroup: "Chest & Triceps" },
  deadBug:                 { reps: 10, sets: 3, holdSeconds: 0,  frequencyPerWeek: 5, difficulty: "beginner",     muscleGroup: "Core & Back" },
  bridge:                  { reps: 12, sets: 3, holdSeconds: 0,  frequencyPerWeek: 5, difficulty: "beginner",     muscleGroup: "Core & Glutes" },
  pullUp:                  { reps: 6,  sets: 3, holdSeconds: 0,  frequencyPerWeek: 3, difficulty: "advanced",     muscleGroup: "Back & Biceps" },
  lateralExternalRotation: { reps: 12, sets: 3, holdSeconds: 0,  frequencyPerWeek: 4, difficulty: "beginner",     muscleGroup: "Rotator Cuff" },
  muscleUp:                { reps: 4,  sets: 3, holdSeconds: 0,  frequencyPerWeek: 2, difficulty: "advanced",     muscleGroup: "Upper Body" },
  plank:                   { reps: 1,  sets: 3, holdSeconds: 30, frequencyPerWeek: 5, difficulty: "beginner",     muscleGroup: "Core" },
  pilatesHundred:          { reps: 1,  sets: 3, holdSeconds: 30, frequencyPerWeek: 4, difficulty: "intermediate", muscleGroup: "Core & Abs" },
  lunge:                   { reps: 10, sets: 3, holdSeconds: 0,  frequencyPerWeek: 4, difficulty: "beginner",     muscleGroup: "Legs & Glutes" },
  legRaise:                { reps: 12, sets: 3, holdSeconds: 0,  frequencyPerWeek: 4, difficulty: "beginner",     muscleGroup: "Lower Abs" },
  toeTouch:                { reps: 10, sets: 3, holdSeconds: 5,  frequencyPerWeek: 5, difficulty: "beginner",     muscleGroup: "Hamstrings & Back" },
  standingObliqueCrunch:   { reps: 12, sets: 3, holdSeconds: 0,  frequencyPerWeek: 4, difficulty: "beginner",     muscleGroup: "Obliques" },
  treePose:                { reps: 1,  sets: 2, holdSeconds: 30, frequencyPerWeek: 5, difficulty: "beginner",     muscleGroup: "Balance & Legs" },
  shoulderPress:           { reps: 10, sets: 3, holdSeconds: 0,  frequencyPerWeek: 3, difficulty: "intermediate", muscleGroup: "Shoulders" },
  shoulderRolls:           { reps: 15, sets: 2, holdSeconds: 0,  frequencyPerWeek: 7, difficulty: "beginner",     muscleGroup: "Neck & Shoulders" },
};

/**
 * Distribute exercises across a 7-day weekly schedule.
 * Returns an array of 7 objects { day, dayName, exercises[] }.
 */
function buildWeeklySchedule(exercises) {
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const schedule = dayNames.map((name, i) => ({ day: i + 1, dayName: name, exercises: [] }));

  exercises.forEach((ex) => {
    const freq = ex.frequencyPerWeek || 3;
    // Spread evenly across the week
    const step = Math.max(1, Math.floor(7 / freq));
    let placed = 0;
    for (let d = 0; d < 7 && placed < freq; d += step) {
      schedule[d].exercises.push(ex.id);
      placed++;
    }
    // Fill remaining if step rounding missed some
    for (let d = 0; placed < freq && d < 7; d++) {
      if (!schedule[d].exercises.includes(ex.id)) {
        schedule[d].exercises.push(ex.id);
        placed++;
      }
    }
  });

  return schedule;
}

/**
 * Analyze injury text and return recommended exercises with plan details.
 */
export function analyzeInjury(text) {
  if (!text || typeof text !== "string") {
    return { found: false, matchedConditions: [], exercises: [], weeklySchedule: [], message: "No input provided." };
  }

  const input = text.toLowerCase();
  const matchedExerciseIds = new Set();
  const matchedConditions = [];

  for (const [keyword, exerciseIds] of Object.entries(injuryKeywordMap)) {
    if (input.includes(keyword)) {
      matchedConditions.push(keyword);
      exerciseIds.forEach((id) => matchedExerciseIds.add(id));
    }
  }

  if (matchedExerciseIds.size === 0) {
    return {
      found: false,
      matchedConditions: [],
      exercises: [],
      weeklySchedule: [],
      message: "Could not identify matching exercises from the provided injury details. Try describing specific body parts or conditions (e.g., 'knee pain', 'lower back pain', 'shoulder stiffness').",
    };
  }

  const exercises = Array.from(matchedExerciseIds).map((id) => {
    const plan = exercisePlanDefaults[id] || { reps: 10, sets: 3, holdSeconds: 0, frequencyPerWeek: 3, difficulty: "beginner", muscleGroup: "General" };
    return {
      id,
      name: id.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
      description: content.catalog[id] || "",
      video: content.instructionVideos[id] || "",
      instructions: content.instructions[id] || content.instructions[id.toLowerCase()] || "",
      reps: plan.reps,
      sets: plan.sets,
      holdSeconds: plan.holdSeconds,
      frequencyPerWeek: plan.frequencyPerWeek,
      difficulty: plan.difficulty,
      muscleGroup: plan.muscleGroup,
    };
  });

  const weeklySchedule = buildWeeklySchedule(exercises);

  return {
    found: true,
    matchedConditions,
    exercises,
    weeklySchedule,
    message: `Found ${exercises.length} recommended exercise${exercises.length !== 1 ? "s" : ""} for: ${matchedConditions.join(", ")}.`,
  };
}

/**
 * Extract text from a PDF file using pdfjs-dist.
 * Returns the full text content of the PDF.
 */
export async function extractTextFromPDF(file) {
  const pdfjsLib = await import("pdfjs-dist/build/pdf");
  const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.entry");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    fullText += pageText + "\n";
  }

  return fullText.trim();
}
