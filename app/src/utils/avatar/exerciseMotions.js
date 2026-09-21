/**
 * Exercise motion library for the 3D coach avatar.
 *
 * Every exercise is a looping timeline of key poses. A key pose is a partial pose merged over a
 * base pose; the player eases between keys, holds, shows the key's coaching cue and counts reps.
 *
 * Pose schema (angles in degrees, distances in metres, body frame: +Z forward, +X character's left):
 *   root   { x, y, z, pitch (+ lean forward), yaw, roll }       pelvis placement
 *   spine  { flex (+ forward), side (+ toward left), twist }    distributed over the 3 spine bones
 *   neck   { flex, side, twist }
 *   clavL/clavR { elev, ret }                                     shoulder shrug / retraction
 *   armL/armR   FK: { flex, abd, rot (+ external), elbow, pron, wrist }
 *               IK: { ik: [x,y,z], pole: [x,y,z], palm: { dir, normal } }
 *   legL/legR   FK: { flex, abd, rot, knee, ankle, flat }
 *               IK: { ik: true, ball: [out, forward, up], toeOut, kneeOut, heel }
 *   fingers 0..1 curl, anchor: bone names whose floor position must not slide
 *   arm `plant` 0..1: after placing the body, press that hand flat onto the floor
 *   seniorRange: 1 keeps the full range for the senior coach (holds, poses that must be complete)
 *
 * Cues are ids translated in coachI18n.js: "squat.stand" or ["lunge.step", "left"].
 */

const STAND = {
  root: { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 },
  spine: { flex: 0, side: 0, twist: 0 },
  neck: { flex: 0, side: 0, twist: 0 },
  clavL: { elev: 0, ret: 0 },
  clavR: { elev: 0, ret: 0 },
  armL: { flex: 4, abd: 9, rot: 0, elbow: 14, pron: 15, wrist: 0 },
  armR: { flex: 4, abd: 9, rot: 0, elbow: 14, pron: 15, wrist: 0 },
  legL: { flex: 0, abd: 3, rot: 4, knee: 3, ankle: 0, flat: true },
  legR: { flex: 0, abd: 3, rot: 4, knee: 3, ankle: 0, flat: true },
  fingers: 0.35,
};

const IK_LEG = { ik: true, ball: [0.03, 0, 0], toeOut: 10, kneeOut: 0, heel: 0 };
const STAND_IK = merge(STAND, { root: { y: -0.012 }, legL: IK_LEG, legR: IK_LEG });

const SUPINE = merge(STAND, {
  root: { pitch: -90 },
  neck: { flex: 6 },
  armL: { flex: 2, abd: 12, elbow: 6, pron: 90, plant: 1 },
  armR: { flex: 2, abd: 12, elbow: 6, pron: 90, plant: 1 },
  legL: { flex: 0, abd: 4, knee: 2, ankle: -20, flat: false },
  legR: { flex: 0, abd: 4, knee: 2, ankle: -20, flat: false },
  fingers: 0.15,
});

function isObj(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

/** Deep merge; later arguments win, arrays are replaced. */
export function merge(...objs) {
  const out = {};
  for (const o of objs) {
    if (!o) continue;
    for (const [k, v] of Object.entries(o))
      out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : isObj(v) ? merge(v) : v;
  }
  return out;
}

/** Swap left/right so the coach performs the movement as a mirror image. */
export function mirrorPose(p) {
  const out = {};
  const swap = { armL: "armR", armR: "armL", legL: "legR", legR: "legL", clavL: "clavR", clavR: "clavL" };
  for (const [k, v] of Object.entries(p)) out[swap[k] || k] = isObj(v) ? merge(v) : v;
  for (const seg of ["spine", "neck"])
    if (out[seg]) {
      out[seg].side = -(out[seg].side || 0);
      out[seg].twist = -(out[seg].twist || 0);
    }
  if (out.root) ["x", "yaw", "roll"].forEach((k) => (out.root[k] = -(out.root[k] || 0)));
  for (const a of ["armL", "armR"]) {
    const arm = out[a];
    if (!arm) continue;
    if (arm.ik) arm.ik = [-arm.ik[0], arm.ik[1], arm.ik[2]];
    if (arm.pole) arm.pole = [-arm.pole[0], arm.pole[1], arm.pole[2]];
    if (arm.palm) arm.palm = { dir: flipX(arm.palm.dir), normal: flipX(arm.palm.normal) };
  }
  if (Array.isArray(out.anchor))
    out.anchor = out.anchor.map((n) => n.replace(/^(Left|Right)/, (m) => (m === "Left" ? "Right" : "Left")));
  return out;
}
const flipX = (v) => [-v[0], v[1], v[2]];

/** Mirror a whole sequence of keys (used to run the second side of unilateral exercises). */
const swapSide = (cue) => (Array.isArray(cue) ? [cue[0], cue[1] === "left" ? "right" : "left"] : cue);
const otherSide = (keys) => keys.map((k) => ({ ...k, pose: mirrorPose(k.pose), cue: swapSide(k.cue) }));

/**
 * Bar geometry for hanging exercises. The bar height is chosen so a dead hang has nearly
 * straight arms and the feet clear the floor; returns the pelvis heights for hang and support.
 */
function barSetup(ctx, hx, z) {
  const { m } = ctx;
  const k = m.height / 1.7;
  const reach = Math.sqrt(m.armReach ** 2 - (hx - m.shoulderX) ** 2);
  const hangY = 0.17 * k;
  const wristY = m.shoulderY + hangY + reach * 0.97;
  const bar = { z, hand: m.hand, y: wristY + gripOffset("hang", m.hand)[0], width: hx * 2 + 0.6 };
  bar.hangY = hangY;
  // Straight-arm support: shoulders one arm-length above the wrists resting on the bar.
  bar.supportY = bar.y + gripOffset("support", m.hand)[0] + reach * 0.96 - m.shoulderY;
  ctx.bar = { y: bar.y, z, width: bar.width };
  return bar;
}

/**
 * Wrist position relative to the bar centre for each grip, as [up, forward] in metres, measured
 * from the character's own hand (len = wrist to knuckles, palm = hand bone to palm surface):
 *   hang    - palm facing forward, bar across the finger roots, fingers wrapped over it
 *   side    - wrist rolled round behind the bar (muscle-up transition)
 *   support - heel of the palm resting on top of the bar
 */
function gripOffset(style, hand) {
  if (style === "hang") return [0.88 * hand.len, -0.96 * hand.palm];
  if (style === "side") return [0, -1.07 * hand.len];
  return [2.0 * hand.palm, -0.63 * hand.len];
}
const GRIP_PALM = {
  hang: { dir: [0, 1, 0], normal: [0, 0, 1] },
  side: { dir: [0, 0.7, 0.7], normal: [0, -0.7, 0.7] },
  support: { dir: [0, 0.15, 1], normal: [0, -1, 0.15] },
};

function barGrip(ctx, bar, s, hx, style, pole) {
  const [up, fwd0] = gripOffset(style, bar.hand);
  const [du, dz] = bar.adjust?.[style] || [0, 0];
  const fwd = fwd0 + dz;
  const y = (style === "support" ? bar.y + up : bar.y - up) + du;
  // Once the wrist rolls over the bar the thumb stays alongside the fingers instead of
  // curling into the bar.
  const thumb = style === "hang" ? undefined : 0;
  return { ik: [s * hx, y, bar.z + fwd], pole: [s * pole[0], pole[1], pole[2]], palm: GRIP_PALM[style], thumb };
}

export const MOTIONS = {
  squat: {
    view: { az: 60, el: 6 },
    opts: { ground: "none" },
    keys: () => {
      const stand = merge(STAND_IK, {
        legL: { ball: [0.07, 0, 0], toeOut: 14 },
        legR: { ball: [0.07, 0, 0], toeOut: 14 },
      });
      const bottom = merge(stand, {
        root: { y: -0.47, z: -0.22, pitch: 34 },
        spine: { flex: -6 },
        neck: { flex: -24 },
        legL: { kneeOut: 6 },
        legR: { kneeOut: 6 },
        armL: { flex: 112, abd: 12, elbow: 8, pron: 60 },
        armR: { flex: 112, abd: 12, elbow: 8, pron: 60 },
      });
      return [
        { pose: stand, move: 1.4, hold: 0.7, cue: "squat.stand", rep: true },
        { pose: bottom, move: 1.9, hold: 0.5, cue: "squat.down" },
      ];
    },
  },

  pushUp: {
    view: { az: 75, el: 12 },
    props: ["mat"],
    opts: { ground: "auto", contacts: ["LeftToe_End", "RightToe_End"], anchorXZ: ["LeftToe_End", "RightToe_End"] },
    keys: (ctx) => {
      const body = (pitch) =>
        merge(STAND, {
          root: { pitch },
          neck: { flex: -14 },
          legL: { abd: 2, knee: 0, ankle: -18, flat: false },
          legR: { abd: 2, knee: 0, ankle: -18, flat: false },
          armL: { flex: pitch, abd: 11, elbow: 0 },
          armR: { flex: pitch, abd: 11, elbow: 0 },
          fingers: 0.05,
        });
      // Find the body angle at which straight arms just reach the floor, so the hands stay
      // planted at the top instead of the IK clamping short of the floor.
      let lo = 50,
        hi = 88;
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        if (ctx.plantHands(body(mid), { opts: MOTIONS.pushUp.opts }).floorGap > 0) lo = mid;
        else hi = mid;
      }
      const top = hi + 0.8;
      const hands = ctx.plantHands(body(top), { opts: MOTIONS.pushUp.opts });
      const arms = (pose) =>
        merge(pose, {
          armL: { ik: hands.L, pole: [0.7, 0.1, -1], palm: { dir: [0.25, 0, 1], normal: [0, -1, 0] } },
          armR: { ik: hands.R, pole: [-0.7, 0.1, -1], palm: { dir: [-0.25, 0, 1], normal: [0, -1, 0] } },
        });
      return [
        { pose: arms(body(top)), move: 1.2, hold: 0.5, cue: "pushUp.up", rep: true },
        { pose: arms(merge(body(86), { neck: { flex: -8 } })), move: 1.6, hold: 0.3, cue: "pushUp.down" },
      ];
    },
  },

  plank: {
    seniorRange: 1,
    view: { az: 70, el: 12 },
    props: ["mat"],
    opts: { ground: "auto", contacts: ["LeftToe_End", "RightToe_End", "LeftForeArm", "RightForeArm"] },
    keys: (ctx) => {
      const plank = (pitch, spineFlex = 0) =>
        merge(STAND, {
          root: { pitch },
          spine: { flex: spineFlex },
          neck: { flex: -16 },
          legL: { abd: 2, knee: 0, ankle: -14, flat: false },
          legR: { abd: 2, knee: 0, ankle: -14, flat: false },
          armL: { flex: pitch + spineFlex, abd: 8, elbow: 92, rot: -12, pron: 70, plant: 1 },
          armR: { flex: pitch + spineFlex, abd: 8, elbow: 92, rot: -12, pron: 70, plant: 1 },
          fingers: 0.55,
        });
      // Solve the body angle at which the elbows rest on the mat while the toes stay grounded.
      const toes = { ground: "auto", contacts: ["LeftToe_End", "RightToe_End"] };
      const elbowFloor = 0.045 * (ctx.m.height / 1.7);
      let lo = 60,
        hi = 89;
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        if (ctx.boneY(plank(mid), toes, "LeftForeArm") > elbowFloor) lo = mid;
        else hi = mid;
      }
      const p = hi;
      return [
        { pose: plank(p), move: 1.5, hold: 2.5, cue: "plank.align" },
        { pose: plank(p + 0.6, 1), move: 1.5, hold: 2.5, cue: "plank.brace" },
        { pose: plank(p), move: 1.5, hold: 2.5, cue: "plank.breathe" },
      ];
    },
  },

  bridge: {
    view: { az: 80, el: 14 },
    props: ["mat"],
    opts: { ground: "auto", anchorXZ: ["LeftFoot", "RightFoot"] },
    keys: () => {
      const down = merge(SUPINE, {
        legL: { flex: 62, abd: 8, knee: 112, flat: true },
        legR: { flex: 62, abd: 8, knee: 112, flat: true },
      });
      const up = merge(down, {
        root: { pitch: -128 },
        spine: { flex: 34 },
        neck: { flex: 12 },
        legL: { flex: -8, knee: 124 },
        legR: { flex: -8, knee: 124 },
        armL: { flex: -36 },
        armR: { flex: -36 },
      });
      return [
        { pose: down, move: 1.6, hold: 0.8, cue: "bridge.down", rep: true },
        { pose: up, move: 1.6, hold: 1.2, cue: "bridge.up" },
      ];
    },
  },

  deadBug: {
    view: { az: 55, el: 32 },
    props: ["mat"],
    opts: { ground: "auto" },
    keys: () => {
      const table = merge(SUPINE, {
        neck: { flex: 4 },
        armL: { flex: 88, abd: 6, elbow: 4, pron: 0, plant: 0 },
        armR: { flex: 88, abd: 6, elbow: 4, pron: 0, plant: 0 },
        legL: { flex: 90, abd: 6, knee: 90, ankle: -5 },
        legR: { flex: 90, abd: 6, knee: 90, ankle: -5 },
      });
      const extend = merge(table, {
        armR: { flex: 172, abd: 10 },
        legL: { flex: 18, knee: 6, ankle: -20 },
      });
      const keys = [
        { pose: table, move: 1.3, hold: 0.5, cue: "deadBug.table" },
        { pose: extend, move: 1.8, hold: 0.6, cue: "deadBug.extend", rep: true },
      ];
      return [...keys, ...otherSide(keys)];
    },
  },

  legRaise: {
    view: { az: 78, el: 14 },
    props: ["mat"],
    opts: { ground: "auto" },
    keys: () => {
      const down = merge(SUPINE, { legL: { flex: 8, knee: 2 }, legR: { flex: 8, knee: 2 } });
      const up = merge(down, {
        root: { pitch: -94 },
        neck: { flex: 10 },
        legL: { flex: 90, ankle: -5 },
        legR: { flex: 90, ankle: -5 },
      });
      return [
        { pose: down, move: 2.0, hold: 0.4, cue: "legRaise.down" },
        { pose: up, move: 1.7, hold: 0.5, cue: "legRaise.up", rep: true },
      ];
    },
  },

  pilatesHundred: {
    view: { az: 75, el: 18 },
    props: ["mat"],
    opts: { ground: "auto" },
    keys: () => {
      const base = merge(SUPINE, {
        spine: { flex: 26 },
        neck: { flex: 22 },
        legL: { flex: 45, abd: 2, knee: 0, ankle: -30 },
        legR: { flex: 45, abd: 2, knee: 0, ankle: -30 },
        armL: { flex: 24, abd: 6, elbow: 0, pron: 90, plant: 0 },
        armR: { flex: 24, abd: 6, elbow: 0, pron: 90, plant: 0 },
      });
      const pumpUp = merge(base, { armL: { flex: 34 }, armR: { flex: 34 } });
      const pumpDown = merge(base, { armL: { flex: 18 }, armR: { flex: 18 } });
      const keys = [];
      for (let i = 0; i < 10; i++) {
        const cue = i < 5 ? "pilates.in" : "pilates.out";
        keys.push(
          { pose: pumpUp, move: 0.25, hold: 0, cue },
          { pose: pumpDown, move: 0.25, hold: 0, cue, rep: i === 9 },
        );
      }
      return keys;
    },
  },

  lateralExternalRotation: {
    view: { az: 32, el: 8 },
    opts: { ground: "auto", anchorXZ: ["LeftFoot", "RightFoot"] },
    keys: () => {
      const start = merge(STAND, { armL: { flex: 0, abd: 88, rot: 0, elbow: 90, pron: 0, wrist: 0 }, fingers: 0.7 });
      const up = merge(start, { armL: { rot: 88 } });
      return [
        { pose: start, move: 1.6, hold: 0.4, cue: "ler.start" },
        { pose: up, move: 1.5, hold: 0.6, cue: "ler.up", rep: true },
      ];
    },
  },

  lunge: {
    view: { az: 78, el: 6 },
    opts: { ground: "none" },
    keys: () => {
      const stand = STAND_IK;
      const swing = merge(stand, {
        root: { z: 0.08, y: -0.02 },
        legL: { ball: [0.05, 0.32, 0.1], heel: -12 },
        legR: { heel: 20 },
      });
      const land = merge(stand, {
        root: { z: 0.28, y: -0.07 },
        legL: { ball: [0.06, 0.62, 0] },
        legR: { heel: 40, toeOut: 4 },
      });
      const low = merge(land, {
        root: { z: 0.3, y: -0.44, pitch: 4 },
        spine: { flex: -2 },
        neck: { flex: -4 },
        legR: { heel: 62 },
        armL: { elbow: 20 },
        armR: { elbow: 20 },
      });
      const keys = [
        { pose: stand, move: 0.9, hold: 0.5, cue: "lunge.stand" },
        { pose: swing, move: 0.45, hold: 0, cue: ["lunge.step", "left"] },
        { pose: land, move: 0.45, hold: 0.2, cue: ["lunge.step", "left"] },
        { pose: low, move: 1.4, hold: 0.5, cue: "lunge.down", rep: true },
        { pose: land, move: 1.2, hold: 0, cue: "lunge.push" },
        { pose: swing, move: 0.45, hold: 0, cue: "lunge.back" },
      ];
      return [...keys, ...otherSide(keys)];
    },
  },

  pullUp: {
    seniorRange: 1,
    view: { az: 150, el: 4 },
    props: ["bar"],
    opts: { ground: "none" },
    keys: (ctx) => {
      const { m } = ctx;
      const hx = m.shoulderX + 0.16;
      const bar = barSetup(ctx, hx, 0.02);
      bar.adjust = {};
      const makeHang = () =>
        merge(STAND, {
          root: { y: bar.hangY },
          clavL: { elev: 14 },
          clavR: { elev: 14 },
          legL: { flex: 12, knee: 28, ankle: -25, flat: false },
          legR: { flex: 8, knee: 22, ankle: -25, flat: false },
          armL: barGrip(ctx, bar, 1, hx, "hang", [1, -1, -0.15]),
          armR: barGrip(ctx, bar, -1, hx, "hang", [1, -1, -0.15]),
          fingers: 0.78,
        });
      bar.adjust.hang = ctx.fitGrip(ctx.bar, (du, dz) => ((bar.adjust.hang = [du, dz]), makeHang()));
      const hang = makeHang();
      const top = merge(hang, {
        // Chin over the bar with the face just behind it.
        root: { y: bar.y - 0.2 - m.shoulderY + 0.05, z: -0.045, pitch: -6 },
        spine: { flex: -10 },
        neck: { flex: -14 },
        clavL: { elev: -6, ret: 10 },
        clavR: { elev: -6, ret: 10 },
        legL: { flex: 18 },
        legR: { flex: 14 },
      });
      ctx.clearBar(ctx.bar, top, /^(Head|Neck|HeadTop_End)$/, 0.015);
      // Hang from the same distance behind the bar, so the face doesn't brush it on the way up.
      hang.root.z = top.root.z;
      return [
        { pose: hang, move: 1.6, hold: 0.5, cue: "pullUp.hang" },
        { pose: top, move: 1.3, hold: 0.4, cue: "pullUp.top", rep: true },
      ];
    },
  },

  muscleUp: {
    seniorRange: 1,
    view: { az: 40, el: 6 },
    props: ["bar"],
    opts: { ground: "none" },
    keys: (ctx) => {
      const { m } = ctx;
      const hx = m.shoulderX + 0.1;
      const bar = barSetup(ctx, hx, 0.06);
      bar.adjust = {};
      const grip = (style, pole) => ({
        armL: barGrip(ctx, bar, 1, hx, style, pole),
        armR: barGrip(ctx, bar, -1, hx, style, pole),
      });
      const build = () => {
        const hang = merge(STAND, {
          root: { y: bar.hangY },
          clavL: { elev: 12 },
          clavR: { elev: 12 },
          legL: { flex: 10, knee: 20, ankle: -25, flat: false },
          legR: { flex: 10, knee: 20, ankle: -25, flat: false },
          ...grip("hang", [1, -1, -0.2]),
          fingers: 0.78,
        });
        const pull = merge(hang, {
          root: { y: bar.y - m.shoulderY - 0.3, z: -0.12, pitch: -14 },
          spine: { flex: -6 },
          legL: { flex: 30, knee: 30 },
          legR: { flex: 30, knee: 30 },
          ...grip("hang", [0.5, -0.5, -1]),
        });
        // Chin reaches the bar while leaning back, so the head then goes over the bar, not through it.
        const highPull = merge(pull, {
          root: { y: bar.y - m.shoulderY - 0.13, z: -0.17, pitch: -18 },
          spine: { flex: -8 },
          neck: { flex: -6 },
        });
        const transition = merge(pull, {
          // Shoulders well above the bar, which now rests against the lower chest.
          root: { y: bar.y - m.shoulderY + 0.22, z: -0.08, pitch: 24 },
          spine: { flex: 18 },
          neck: { flex: 10 },
          ...grip("side", [0.3, 0.2, -1]),
          fingers: 0.5,
        });
        const backOver = merge(highPull, {
          root: { y: bar.y - m.shoulderY + 0.1, z: -0.2, pitch: -8 },
          ...grip("side", [0.3, 0.2, -1]),
          fingers: 0.5,
        });
        // Lockout: arms straight on top of the bar, which sits in front of the hips.
        const top = merge(transition, {
          root: { y: bar.supportY, z: -0.1, pitch: 8 },
          spine: { flex: 4 },
          neck: { flex: 0 },
          clavL: { elev: -8 },
          clavR: { elev: -8 },
          legL: { flex: 6, knee: 10 },
          legR: { flex: 6, knee: 10 },
          ...grip("support", [0.3, 0, -1]),
          fingers: 0.5,
        });
        return { hang, pull, highPull, transition, backOver, top };
      };
      // Fit each grip on the pose that uses it: hanging, rolled over the bar, pressing on top.
      for (const [style, key] of [
        ["hang", "hang"],
        ["side", "transition"],
        ["support", "top"],
      ]) {
        bar.adjust[style] = ctx.fitGrip(ctx.bar, (du, dz) => ((bar.adjust[style] = [du, dz]), build()[key]));
      }
      const { hang, pull, highPull, transition, backOver, top } = build();
      // Bigger bodies need more room: keep the hips and trunk off the bar at lockout, and the
      // chest just touching it (not through it) while leaning over.
      ctx.clearBar(ctx.bar, top, /^(Hips|Spine|Spine1|Spine2|LeftUpLeg|RightUpLeg)$/, 0.01);
      ctx.clearBar(ctx.bar, transition, /^(Hips|Spine|Spine1|Spine2|Neck|Head)$/, 0.006);
      ctx.clearBar(ctx.bar, backOver, /^(Hips|Spine|Spine1|Spine2|Neck|Head)$/, 0.01);
      ctx.clearBar(ctx.bar, highPull, /^(Neck|Head|HeadTop_End)$/, 0.015);
      // Between leaning over the bar and lockout the bar slides along the belly; waypoints keep
      // it touching the body rather than passing inside it (used on the way up and down).
      const trunk = /^(Hips|Spine|Spine1|Spine2|LeftUpLeg|RightUpLeg)$/;
      const press1 = ctx.clearBar(ctx.bar, ctx.blend(transition, top, 1 / 3), trunk, 0.012);
      const press2 = ctx.clearBar(ctx.bar, ctx.blend(transition, top, 2 / 3), trunk, 0.012);
      return [
        { pose: hang, move: 1.2, hold: 0.5, cue: "muscleUp.hang" },
        { pose: pull, move: 0.7, hold: 0, cue: "muscleUp.pull" },
        { pose: highPull, move: 0.4, hold: 0, cue: "muscleUp.pull" },
        { pose: backOver, move: 0.35, hold: 0, cue: "muscleUp.lean" },
        { pose: transition, move: 0.45, hold: 0, cue: "muscleUp.lean" },
        { pose: press1, move: 0.27, hold: 0, cue: "muscleUp.press" },
        { pose: press2, move: 0.27, hold: 0, cue: "muscleUp.press" },
        { pose: top, move: 0.27, hold: 0.6, cue: "muscleUp.press", rep: true },
        // Come back down the same way (over the bar, then under it) instead of through it.
        { pose: press2, move: 0.3, hold: 0, cue: "muscleUp.lower" },
        { pose: press1, move: 0.3, hold: 0, cue: "muscleUp.lower" },
        { pose: transition, move: 0.3, hold: 0, cue: "muscleUp.lower" },
        // Lean back while still high so the head clears the bar before dropping below it.
        { pose: backOver, move: 0.5, hold: 0, cue: "muscleUp.lower" },
        { pose: highPull, move: 0.5, hold: 0, cue: "muscleUp.lower" },
        { pose: pull, move: 0.6, hold: 0, cue: "muscleUp.lower" },
      ];
    },
  },

  shoulderPress: {
    view: { az: 20, el: 4 },
    opts: { ground: "auto", anchorXZ: ["LeftFoot", "RightFoot"] },
    keys: () => {
      const rack = merge(STAND, {
        armL: { flex: 28, abd: 62, rot: 78, elbow: 108, pron: 50 },
        armR: { flex: 28, abd: 62, rot: 78, elbow: 108, pron: 50 },
        fingers: 0.85,
      });
      const press = merge(rack, {
        armL: { flex: 20, abd: 160, rot: 80, elbow: 14 },
        armR: { flex: 20, abd: 160, rot: 80, elbow: 14 },
        clavL: { elev: 10 },
        clavR: { elev: 10 },
      });
      return [
        { pose: rack, move: 1.6, hold: 0.4, cue: "press.rack" },
        { pose: press, move: 1.3, hold: 0.4, cue: "press.up", rep: true },
      ];
    },
  },

  shoulderRolls: {
    view: { az: 25, el: 4, focus: "torso" },
    opts: { ground: "auto", anchorXZ: ["LeftFoot", "RightFoot"] },
    keys: () => {
      const shr = (elev, ret) =>
        merge(STAND, { clavL: { elev, ret }, clavR: { elev, ret }, armL: { abd: 7 }, armR: { abd: 7 } });
      return [
        { pose: shr(0, -4), move: 0.7, hold: 0, cue: "rolls.relax" },
        { pose: shr(34, 0), move: 0.8, hold: 0.2, cue: "rolls.up" },
        { pose: shr(22, 26), move: 0.7, hold: 0.1, cue: "rolls.back" },
        { pose: shr(-8, 16), move: 0.8, hold: 0.1, cue: "rolls.down", rep: true },
      ];
    },
  },

  neckTilt: {
    view: { az: 10, el: 6, focus: "upper" },
    opts: { ground: "auto", anchorXZ: ["LeftFoot", "RightFoot"] },
    keys: () => {
      const tilt = (side) => merge(STAND, { neck: { side }, clavL: { elev: -3 }, clavR: { elev: -3 } });
      return [
        { pose: tilt(0), move: 1.4, hold: 0.6, cue: "neck.center" },
        { pose: tilt(-44), move: 1.8, hold: 2.2, cue: ["neck.tilt", "right"], rep: true },
        { pose: tilt(0), move: 1.4, hold: 0.6, cue: "neck.back" },
        { pose: tilt(44), move: 1.8, hold: 2.2, cue: ["neck.tilt", "left"], rep: true },
      ];
    },
  },

  calfRaise: {
    view: { az: 70, el: 4 },
    opts: { ground: "none" },
    keys: () => {
      const flat = merge(STAND_IK, { armL: { abd: 12 }, armR: { abd: 12 } });
      const up = merge(flat, { root: { y: 0.075, z: 0.02 }, legL: { heel: 34 }, legR: { heel: 34 } });
      return [
        { pose: flat, move: 1.4, hold: 0.5, cue: "calf.flat" },
        { pose: up, move: 1.0, hold: 1.0, cue: "calf.up", rep: true },
      ];
    },
  },

  seatedKneeExtension: {
    seniorRange: 1,
    view: { az: 70, el: 8 },
    props: ["chair"],
    opts: { ground: "auto", contacts: ["LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"], anchorXZ: ["Hips"] },
    keys: () => {
      const seated = merge(STAND, {
        spine: { flex: -2 },
        legL: { flex: 88, abd: 6, knee: 88, flat: true },
        legR: { flex: 88, abd: 6, knee: 88, flat: true },
        armL: { flex: 30, abd: 16, elbow: 50, pron: 80 },
        armR: { flex: 30, abd: 16, elbow: 50, pron: 80 },
      });
      const extend = merge(seated, { legL: { knee: 6, ankle: 12, flat: false } });
      const keys = [
        { pose: seated, move: 1.6, hold: 0.5, cue: "ske.seated" },
        { pose: extend, move: 1.4, hold: 1.2, cue: ["ske.extend", "left"], rep: true },
      ];
      return [...keys, ...otherSide(keys)];
    },
  },

  wallSit: {
    view: { az: 75, el: 6 },
    props: ["wall"],
    opts: { ground: "none" },
    keys: (ctx) => {
      const legs = { legL: { ball: [0.07, 0.42, 0], toeOut: 10 }, legR: { ball: [0.07, 0.42, 0], toeOut: 10 } };
      const lean = merge(STAND_IK, legs, { root: { y: -0.24, pitch: -4 }, neck: { flex: 2 } });
      const sit = merge(STAND_IK, legs, {
        root: { y: -0.42, pitch: 0 },
        armL: { flex: 6, abd: 14, elbow: 20 },
        armR: { flex: 6, abd: 14, elbow: 20 },
      });
      ctx.alignToWall([lean, sit]);
      return [
        { pose: lean, move: 1.8, hold: 0.4, cue: "wall.lean" },
        { pose: sit, move: 2.0, hold: 4.0, cue: "wall.sit", rep: true },
      ];
    },
  },

  toeTouch: {
    view: { az: 72, el: 6 },
    opts: { ground: "none" },
    keys: () => {
      const stand = merge(STAND_IK, { legL: { ball: [0.02, 0, 0] }, legR: { ball: [0.02, 0, 0] } });
      const fold = merge(stand, {
        root: { y: -0.1, z: -0.12, pitch: 76 },
        spine: { flex: 44 },
        neck: { flex: 22 },
        armL: { flex: 112, abd: 5, elbow: 4 },
        armR: { flex: 112, abd: 5, elbow: 4 },
      });
      return [
        { pose: stand, move: 2.0, hold: 0.6, cue: "toe.stand" },
        { pose: fold, move: 2.0, hold: 1.4, cue: "toe.fold", rep: true },
      ];
    },
  },

  standingObliqueCrunch: {
    view: { az: 25, el: 6 },
    opts: { ground: "auto" },
    keys: () => {
      const guard = { flex: 10, abd: 92, rot: 105, elbow: 135, pron: 0, wrist: 10 };
      const stand = merge(STAND, { armL: guard, armR: guard, fingers: 0.3, anchor: ["LeftFoot", "RightFoot"] });
      const crunch = merge(stand, {
        spine: { side: 22, flex: 8 },
        root: { roll: -2 },
        legL: { flex: 95, abd: 22, rot: 10, knee: 95, ankle: -15, flat: false },
        legR: { abd: 0 },
        armL: { abd: 70 },
        anchor: ["RightFoot"],
      });
      const keys = [
        { pose: stand, move: 1.2, hold: 0.4, cue: "oblique.stand" },
        { pose: crunch, move: 1.1, hold: 0.5, cue: ["oblique.crunch", "left"], rep: true },
      ];
      return [...keys, ...otherSide(keys)];
    },
  },

  treePose: {
    seniorRange: 1,
    view: { az: 22, el: 6 },
    opts: { ground: "auto" },
    keys: (ctx) => {
      // Palms pressed together: both wrists go to mirrored points just either side of the
      // body's midline (chest frame), with the palms turned to face each other.
      const k = ctx.m.height / 1.7;
      const join = (s, y, z, pole, fit) => ({
        rel: "chest",
        ik: [s * 0.83 * ctx.m.hand.palm, y * k, z * k],
        pole: [s * pole[0], pole[1], pole[2]],
        // Fingertips tilted so the fingers meet the other hand's (fitted per character below).
        palm: { dir: [-s * fit.tilt, 1, 0.12], normal: [-s, 0, 0] },
        ikW: 1,
        fingers: fit.fingers,
      });
      const relaxed = { ikW: 0, fingers: 0.35 };
      const stand = merge(STAND, { anchor: ["RightFoot"], armL: relaxed, armR: relaxed });
      const shift = merge(stand, { root: { x: -0.06 }, legR: { abd: -1 }, legL: { abd: 7 } });
      const makeTree = (tilt, fingers) =>
        merge(shift, {
          legL: { flex: 40, abd: 58, rot: 58, knee: 128, ankle: -25, flat: false },
          armL: join(1, 0.03, 0.2, [1, -0.8, -0.1], { tilt, fingers }),
          armR: join(-1, 0.03, 0.2, [1, -0.8, -0.1], { tilt, fingers }),
        });
      const treeFit = ctx.fitJoin(makeTree);
      const tree = makeTree(treeFit.tilt, treeFit.fingers);
      const makeBranches = (tilt, fingers) =>
        merge(tree, {
          armL: join(1, 0.56, 0.03, [1, 0.1, 0.3], { tilt, fingers }),
          armR: join(-1, 0.56, 0.03, [1, 0.1, 0.3], { tilt, fingers }),
          neck: { flex: -4 },
        });
      const branchFit = ctx.fitJoin(makeBranches);
      const branches = makeBranches(branchFit.tilt, branchFit.fingers);
      const keys = [
        { pose: stand, move: 1.4, hold: 0.5, cue: ["tree.shift", "right"] },
        { pose: shift, move: 0.8, hold: 0, cue: ["tree.shift", "right"] },
        { pose: tree, move: 1.5, hold: 2.0, cue: ["tree.place", "left"] },
        { pose: branches, move: 1.5, hold: 3.0, cue: "tree.arms", rep: true },
        { pose: tree, move: 1.3, hold: 0.3, cue: "tree.lower" },
      ];
      return [...keys, ...otherSide(keys)];
    },
  },
  // ---------------------------------------------------------------------------------------
  // Rehabilitation exercises (gentle, home-based; shown at full range for every coach since
  // their ranges are already the prescribed rehab targets).
  // ---------------------------------------------------------------------------------------

  heelSlide: {
    seniorRange: 1,
    view: { az: 80, el: 16 },
    props: ["mat"],
    opts: { ground: "auto" },
    keys: () => {
      const straight = SUPINE;
      // Knee bends twice as much as the hip, which keeps the heel on the mat as it slides.
      const slid = merge(SUPINE, { legL: { flex: 55, knee: 110, ankle: -5 } });
      const keys = [
        { pose: straight, move: 1.6, hold: 0.6, cue: "heelSlide.start" },
        { pose: slid, move: 2.0, hold: 0.8, cue: ["heelSlide.slide", "left"], rep: true },
      ];
      return [...keys, ...otherSide(keys)];
    },
  },

  anklePumps: {
    seniorRange: 1,
    view: { az: 70, el: 18, focus: undefined },
    props: ["mat"],
    opts: { ground: "auto" },
    keys: () => {
      const rest = merge(SUPINE, { legL: { ankle: -15 }, legR: { ankle: -15 } });
      const toesUp = merge(rest, { legL: { ankle: 18 }, legR: { ankle: 18 } });
      const toesDown = merge(rest, { legL: { ankle: -48 }, legR: { ankle: -48 } });
      return [
        { pose: rest, move: 1.0, hold: 0.4, cue: "anklePumps.start" },
        { pose: toesUp, move: 0.9, hold: 0.5, cue: "anklePumps.up" },
        { pose: toesDown, move: 1.1, hold: 0.5, cue: "anklePumps.down", rep: true },
      ];
    },
  },

  straightLegRaise: {
    seniorRange: 1,
    view: { az: 80, el: 14 },
    props: ["mat"],
    opts: { ground: "auto" },
    keys: () => {
      const start = merge(SUPINE, { legR: { flex: 55, knee: 110, flat: true } });
      const raised = merge(start, { legL: { flex: 45, knee: 0, ankle: 5 } });
      const keys = [
        { pose: start, move: 1.6, hold: 0.6, cue: "straightLegRaise.start" },
        { pose: raised, move: 1.8, hold: 1.2, cue: ["straightLegRaise.lift", "left"], rep: true },
      ];
      return [...keys, ...otherSide(keys)];
    },
  },

  sitToStand: {
    seniorRange: 1,
    view: { az: 75, el: 8 },
    props: ["chair"],
    opts: {
      ground: "auto",
      contacts: ["LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"],
      anchorXZ: ["LeftFoot", "RightFoot"],
    },
    keys: () => {
      const arms = { flex: 30, abd: 14, elbow: 40, pron: 60 };
      const seated = merge(STAND, {
        spine: { flex: -2 },
        legL: { flex: 88, abd: 6, knee: 92, flat: true },
        legR: { flex: 88, abd: 6, knee: 92, flat: true },
        armL: arms,
        armR: arms,
      });
      // Nose over toes: the trunk tips forward while the thighs stay on the seat.
      const lean = merge(seated, {
        root: { pitch: 34 },
        spine: { flex: 6 },
        neck: { flex: -18 },
        legL: { flex: 122 },
        legR: { flex: 122 },
        armL: { flex: 80, elbow: 15 },
        armR: { flex: 80, elbow: 15 },
      });
      const stand = merge(STAND, { armL: { flex: 10, elbow: 15 }, armR: { flex: 10, elbow: 15 } });
      return [
        { pose: seated, move: 1.6, hold: 0.6, cue: "sitToStand.sit" },
        { pose: lean, move: 1.0, hold: 0.2, cue: "sitToStand.lean" },
        { pose: stand, move: 1.5, hold: 0.8, cue: "sitToStand.stand", rep: true },
        { pose: lean, move: 1.6, hold: 0.1, cue: "sitToStand.down" },
      ];
    },
  },

  seatedMarching: {
    seniorRange: 1,
    view: { az: 70, el: 8 },
    props: ["chair"],
    opts: { ground: "auto", contacts: ["LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"], anchorXZ: ["Hips"] },
    keys: () => {
      const hold = { flex: 0, abd: 14, elbow: 12, pron: 30 };
      const seated = merge(STAND, {
        spine: { flex: -3 },
        legL: { flex: 88, abd: 6, knee: 90, flat: true },
        legR: { flex: 88, abd: 6, knee: 90, flat: true },
        armL: hold,
        armR: hold,
      });
      const lift = merge(seated, { legL: { flex: 116, knee: 95, flat: false, ankle: 0 } });
      const keys = [
        { pose: seated, move: 0.9, hold: 0.3, cue: "seatedMarching.sit" },
        { pose: lift, move: 0.9, hold: 0.5, cue: ["seatedMarching.lift", "left"], rep: true },
      ];
      return [...keys, ...otherSide(keys)];
    },
  },

  armRaise: {
    seniorRange: 1,
    view: { az: 65, el: 6 },
    opts: { ground: "auto", anchorXZ: ["LeftFoot", "RightFoot"] },
    keys: () => {
      const down = merge(STAND, { armL: { flex: 4, abd: 6, elbow: 8, pron: 0 }, armR: { flex: 4, abd: 6, elbow: 8, pron: 0 } });
      const up = merge(down, { armL: { flex: 160, abd: 8, elbow: 6 }, armR: { flex: 160, abd: 8, elbow: 6 } });
      return [
        { pose: down, move: 1.8, hold: 0.6, cue: "armRaise.down" },
        { pose: up, move: 2.0, hold: 0.8, cue: "armRaise.up", rep: true },
      ];
    },
  },

  sideArmRaise: {
    seniorRange: 1,
    view: { az: 12, el: 6 },
    opts: { ground: "auto", anchorXZ: ["LeftFoot", "RightFoot"] },
    keys: () => {
      const down = merge(STAND, { armL: { flex: 2, abd: 8, elbow: 8, pron: 0 }, armR: { flex: 2, abd: 8, elbow: 8, pron: 0 } });
      const up = merge(down, { armL: { abd: 88, elbow: 5, pron: 80 }, armR: { abd: 88, elbow: 5, pron: 80 } });
      return [
        { pose: down, move: 1.8, hold: 0.6, cue: "armRaise.down" },
        { pose: up, move: 1.8, hold: 0.8, cue: "sideArmRaise.up", rep: true },
      ];
    },
  },

  wallPushUp: {
    seniorRange: 1,
    // Camera behind the shoulder, so the wall in front of the coach is on the far side.
    view: { az: 112, el: 10 },
    props: ["wallFront"],
    opts: { ground: "auto", contacts: ["LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"], anchorXZ: ["LeftFoot", "RightFoot"] },
    keys: (ctx) => {
      const { m } = ctx;
      const body = (pitch) =>
        merge(STAND, {
          root: { pitch },
          neck: { flex: -pitch * 0.6 },
          legL: { abd: 4, knee: 0, ankle: pitch * 0.8, flat: true },
          legR: { abd: 4, knee: 0, ankle: pitch * 0.8, flat: true },
          armL: { flex: 90 - pitch, abd: 12, elbow: 4 },
          armR: { flex: 90 - pitch, abd: 12, elbow: 4 },
          fingers: 0.1,
        });
      // Hands flat on the wall at shoulder height, arms nearly straight at the start.
      const top = body(10);
      const opts = MOTIONS.wallPushUp.opts;
      const sL = ctx.bonePos(top, opts, "LeftArm");
      const sR = ctx.bonePos(top, opts, "RightArm");
      const handZ = sL[2] + m.armReach * 0.94;
      ctx.wallFront = { z: handZ + m.hand.palm + 0.004 };
      const hand = (s, sp) => ({
        ik: [sp[0] + s * 0.06, sp[1] - 0.04, handZ],
        pole: [s * 0.8, -1, -0.2],
        palm: { dir: [0, 1, 0], normal: [0, 0, 1] },
        fingers: 0.1,
      });
      const onWall = (pose) => merge(pose, { armL: hand(1, sL), armR: hand(-1, sR) });
      return [
        { pose: onWall(top), move: 1.4, hold: 0.5, cue: "wallPushUp.start" },
        { pose: onWall(merge(body(24), { neck: { flex: -10 } })), move: 1.6, hold: 0.4, cue: "wallPushUp.down" },
        { pose: onWall(top), move: 1.4, hold: 0.3, cue: "wallPushUp.up", rep: true },
      ];
    },
  },

  hipAbduction: {
    seniorRange: 1,
    view: { az: 12, el: 6 },
    opts: { ground: "auto" },
    keys: () => {
      const arms = { flex: 6, abd: 22, elbow: 18, pron: 20 };
      const stand = merge(STAND, { anchor: ["RightFoot"], armL: arms, armR: arms });
      const shift = merge(stand, { root: { x: -0.035 }, legR: { abd: 0 }, legL: { abd: 5 } });
      const lift = merge(shift, { spine: { side: -3 }, legL: { abd: 28, flex: 2, knee: 4, flat: false, ankle: 0 } });
      const keys = [
        { pose: stand, move: 1.2, hold: 0.3, cue: ["hipAbduction.stand", "right"] },
        { pose: shift, move: 0.6, hold: 0, cue: ["hipAbduction.stand", "right"] },
        { pose: lift, move: 1.4, hold: 0.6, cue: ["hipAbduction.lift", "left"], rep: true },
        { pose: shift, move: 1.4, hold: 0.2, cue: ["hipAbduction.stand", "right"] },
      ];
      return [...keys, ...otherSide(keys)];
    },
  },

  singleLegBalance: {
    seniorRange: 1,
    view: { az: 30, el: 6 },
    opts: { ground: "auto" },
    keys: () => {
      const arms = { flex: 8, abd: 26, elbow: 22, pron: 40 };
      const stand = merge(STAND, { anchor: ["RightFoot"], armL: arms, armR: arms });
      const shift = merge(stand, { root: { x: -0.04 }, legR: { abd: 0 }, legL: { abd: 5 } });
      const lift = merge(shift, { legL: { flex: 28, knee: 70, flat: false, ankle: -15 }, armL: { abd: 32 }, armR: { abd: 32 } });
      const keys = [
        { pose: stand, move: 1.2, hold: 0.5, cue: "singleLegBalance.stand" },
        { pose: shift, move: 0.7, hold: 0, cue: "singleLegBalance.stand" },
        { pose: lift, move: 1.0, hold: 4.0, cue: ["singleLegBalance.lift", "left"], rep: true },
        { pose: shift, move: 1.1, hold: 0.3, cue: "singleLegBalance.down" },
      ];
      return [...keys, ...otherSide(keys)];
    },
  },

  miniSquat: {
    seniorRange: 1,
    view: { az: 62, el: 6 },
    opts: { ground: "none" },
    keys: () => {
      const stand = merge(STAND_IK, { legL: { ball: [0.05, 0, 0], toeOut: 10 }, legR: { ball: [0.05, 0, 0], toeOut: 10 } });
      const bottom = merge(stand, {
        root: { y: -0.15, z: -0.07, pitch: 16 },
        neck: { flex: -10 },
        legL: { kneeOut: 4 },
        legR: { kneeOut: 4 },
        armL: { flex: 75, abd: 10, elbow: 8, pron: 60 },
        armR: { flex: 75, abd: 10, elbow: 8, pron: 60 },
      });
      return [
        { pose: stand, move: 1.4, hold: 0.6, cue: "miniSquat.stand" },
        { pose: bottom, move: 1.6, hold: 0.5, cue: "miniSquat.down" },
        { pose: stand, move: 1.4, hold: 0.2, cue: "miniSquat.up", rep: true },
      ];
    },
  },
};

/** Calm standing idle for the Digital Twin: breathing, a slow weight shift and relaxed arms. */
MOTIONS.idle = {
  view: { az: 18, el: 6 },
  opts: { ground: "auto", anchorXZ: ["LeftFoot", "RightFoot"] },
  keys: () => {
    const arms = { flex: 3, abd: 8, elbow: 14, pron: 15 };
    const a = merge(STAND, { armL: arms, armR: arms, neck: { flex: 2 } });
    const b = merge(a, { root: { x: 0.012, roll: 0.6 }, spine: { side: -0.8 }, neck: { twist: 6, flex: 0 }, armL: { abd: 9 } });
    const c = merge(a, { root: { x: -0.012, roll: -0.6 }, spine: { side: 0.8 }, neck: { twist: -5 }, armR: { abd: 9 } });
    return [
      { pose: a, move: 2.2, hold: 1.2 },
      { pose: b, move: 2.6, hold: 1.4 },
      { pose: a, move: 2.4, hold: 0.8 },
      { pose: c, move: 2.6, hold: 1.4 },
    ];
  },
};

MOTIONS.pushUpGame = MOTIONS.pushUp;
MOTIONS.squatGame = MOTIONS.squat;

/** Exercise keys (as used in /exercise?exercise=...) that have a coach animation. */
export const hasMotion = (key) => !!MOTIONS[key];
