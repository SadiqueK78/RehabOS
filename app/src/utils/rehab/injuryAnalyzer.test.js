import { analyzeInjury } from "./injuryAnalyzer";

const ids = (text) => analyzeInjury(text).exercises.map((e) => e.id);

test("knee replacement recovery starts with gentle rehab exercises", () => {
  expect(ids("Recovering from a total knee replacement last month")).toEqual(
    expect.arrayContaining(["anklePumps", "heelSlide", "straightLegRaise"])
  );
});

test("elderly patient with falls gets balance and sit-to-stand work", () => {
  expect(ids("72 year old, elderly, had two falls, feels unsteady when walking")).toEqual(
    expect.arrayContaining(["singleLegBalance", "sitToStand"])
  );
});

test("stroke patient gets seated and assisted exercises", () => {
  expect(ids("Stroke 3 months ago, weakness on right side")).toEqual(
    expect.arrayContaining(["seatedMarching", "armRaise"])
  );
});
