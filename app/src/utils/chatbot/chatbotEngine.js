import content from "../../assets/content.json";
import { injuryExerciseMap, muscleExerciseMap } from "./exerciseKnowledgeBase";

export function getExerciseRecommendation(userInput) {
  const input = userInput.toLowerCase();

  let matchedExercises = [];

  Object.keys(injuryExerciseMap).forEach((key) => {
    if (input.includes(key)) {
      matchedExercises = injuryExerciseMap[key];
    }
  });

  Object.keys(muscleExerciseMap).forEach((key) => {
    if (input.includes(key)) {
      matchedExercises = muscleExerciseMap[key];
    }
  });

  if (matchedExercises.length === 0) {
    return {
      found: false,
      message: "No suitable exercise found in this app for the given condition.",
    };
  }

  const results = matchedExercises.map((id) => ({
  id,
  name: id
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase()),
  description: content.catalog[id],
  video: content.instructionVideos[id],
}));


  return {
    found: true,
    exercises: results,
  };
}
