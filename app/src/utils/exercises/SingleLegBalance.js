import { makeBalanceHold } from "./rehabFactory";

/** Single-leg balance: each rep is one foot lifted and held for the target number of seconds. */
const { info, check } = makeBalanceHold({
  title: "Single Leg Balance",
  seconds: 8,
  cues: {
    ready: "Hold a chair and lift one foot",
    holding: "Hold steady, keep breathing",
    done: "Great balance! Lower your foot",
  },
});

export const singleLegBalanceInfo = info;
export const checkSingleLegBalance = check;
