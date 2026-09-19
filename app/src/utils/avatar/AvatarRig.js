import * as THREE from "three";

/**
 * AvatarRig - drives a Mixamo-rigged, skinned character from anatomical joint angles.
 *
 * Poses are described the way a physiotherapist would describe them (hip flexion, knee
 * flexion, shoulder abduction, spine side-bend ...) instead of raw bone rotations. The rig
 * measures the character's rest pose once, then converts each pose into bone orientations
 * via basis alignment, so it works regardless of each bone's local axis conventions.
 *
 * Body frame (model space): +Y up, +Z the direction the character faces, +X the character's left.
 *
 * Legs and arms can be driven either by forward kinematics (joint angles) or by two-bone IK
 * (planted feet / hands on the floor or on a bar), which keeps contacts from sliding.
 */

const D2R = Math.PI / 180;
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const SIDES = [
  ["Left", 1],
  ["Right", -1],
];
const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
const SPINE_SPLIT = [0.35, 0.7, 1];

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const qAxis = (axis, deg) => new THREE.Quaternion().setFromAxisAngle(axis, deg * D2R);
const rotate = (v, axis, deg) => v.clone().applyQuaternion(qAxis(axis, deg));
const IDENTITY = new THREE.Quaternion();

/** Anatomical rotation of a trunk/neck segment: forward flexion, side bend (+ toward left), twist (+ toward left). */
function segmentQuat({ flex = 0, side = 0, twist = 0 } = {}) {
  return qAxis(X, flex).multiply(qAxis(Z, -side)).multiply(qAxis(Y, twist));
}

/** Orthonormal basis quaternion with `a` as the primary axis and `h` as the secondary axis. */
function basisQuat(a, h) {
  const x = a.clone().normalize();
  let y = h.clone().sub(x.clone().multiplyScalar(h.dot(x)));
  if (y.lengthSq() < 1e-8) y = Math.abs(x.y) < 0.9 ? Y.clone().cross(x) : X.clone().cross(x);
  y.normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** Rotation taking the rest basis (aRest, hRest) onto the target basis (aT, hT). */
function alignQuat(aRest, hRest, aT, hT) {
  return basisQuat(aT, hT).multiply(basisQuat(aRest, hRest).invert());
}

/** Two-bone analytic IK. Returns upper/lower directions and the hinge axis. */
function solveTwoBone(start, target, l1, l2, pole) {
  const toT = target.clone().sub(start);
  let d = toT.length();
  const u = d > 1e-6 ? toT.divideScalar(d) : Y.clone().negate();
  d = THREE.MathUtils.clamp(d, Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.9995);
  const cosA = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  let n = pole.clone().sub(u.clone().multiplyScalar(pole.dot(u)));
  if (n.lengthSq() < 1e-8) n = Math.abs(u.y) < 0.9 ? Y.clone() : Z.clone();
  n.normalize();
  const mid = start.clone().add(u.clone().multiplyScalar(l1 * cosA).add(n.clone().multiplyScalar(l1 * sinA)));
  const end = start.clone().add(u.clone().multiplyScalar(d));
  return {
    upper: mid.clone().sub(start).normalize(),
    lower: end.clone().sub(mid).normalize(),
    hinge: new THREE.Vector3().crossVectors(n, u).normalize(),
  };
}

export default class AvatarRig {
  constructor(model, clips = []) {
    this.model = model;
    this.bones = {};
    model.traverse((o) => {
      // End markers (HeadTop_End, Toe_End) may load as plain nodes when nothing is skinned to them.
      if (o.isBone || /^mixamorig/.test(o.name)) this.bones[o.name.replace(/^mixamorig:?/, "")] = o;
    });
    if (!this.bones.Hips) throw new Error("AvatarRig: model has no Mixamo skeleton");

    // Measure from the T-pose when the file ships one, otherwise from the bind pose.
    const tpose = clips.find((c) => /t-?pose/i.test(c.name));
    if (tpose) {
      const mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(tpose).play();
      mixer.update(0);
      mixer.stopAllAction();
    }

    model.updateWorldMatrix(true, true);
    this._modelInv = new THREE.Matrix4().copy(model.matrixWorld).invert();
    this.rest = {};
    for (const [name, bone] of Object.entries(this.bones)) {
      const pos = v3(), q = new THREE.Quaternion(), s = v3();
      this._modelMatrix(bone).decompose(pos, q, s);
      this.rest[name] = { local: bone.quaternion.clone(), pos, q };
    }
    const P = (n) => this.rest[n].pos;

    const hipsParent = this.bones.Hips.parent;
    this.hipsParentMatrix = this._modelMatrix(hipsParent);
    this.hipsParentInv = this.hipsParentMatrix.clone().invert();
    this.hipsParentQ = new THREE.Quaternion();
    this.hipsParentMatrix.decompose(v3(), this.hipsParentQ, v3());

    // Some rigs (3ds Max Biped) hang the thighs off the first spine bone instead of the pelvis.
    // Keep that bone with the pelvis so bending the back doesn't drag the hip joints around.
    this.spineSplit = this.bones.LeftUpLeg?.parent === this.bones.Spine ? [0, 0.5, 1] : SPINE_SPLIT;

    this.height = (P("HeadTop_End") || P("Head")).y - Math.min(P("LeftToe_End")?.y ?? 0, 0);
    const k = this.height / 1.7;

    this.limbs = {};
    for (const [side, s] of SIDES) {
      const armU = P(`${side}ForeArm`).clone().sub(P(`${side}Arm`));
      const armL = P(`${side}Hand`).clone().sub(P(`${side}ForeArm`));
      const armHinge = armU.clone().normalize().cross(Z).normalize();

      const legU = P(`${side}Leg`).clone().sub(P(`${side}UpLeg`));
      const legL = P(`${side}Foot`).clone().sub(P(`${side}Leg`));
      const legHinge = legU.clone().normalize().cross(Z.clone().negate()).normalize();
      const foot = P(`${side}ToeBase`).clone().sub(P(`${side}Foot`));
      const footFwd = legL.clone().normalize().cross(legHinge).normalize();
      const footPitch0 = Math.atan2(foot.dot(legL.clone().normalize().negate()), foot.dot(footFwd));

      const handDir = P(`${side}HandMiddle1`).clone().sub(P(`${side}Hand`)).normalize();
      const across = P(`${side}HandIndex1`).clone().sub(P(`${side}HandPinky1`)).normalize();
      const palm = handDir.clone().cross(across).multiplyScalar(s).normalize();
      const curlAxis = handDir.clone().cross(palm).normalize();

      const fingerBones = [];
      for (const f of FINGERS) {
        for (let i = 1; i <= 3; i++) {
          const n = `${side}Hand${f}${i}`;
          if (!this.bones[n]) continue;
          const axisLocal = curlAxis.clone().applyQuaternion(this.rest[n].q.clone().invert());
          fingerBones.push({ name: n, axisLocal, weight: f === "Thumb" ? 0.35 : 1, joint: i, thumb: f === "Thumb" });
        }
      }

      this.limbs[side] = {
        s,
        arm: {
          l1: armU.length(), l2: armL.length(),
          aU: armU.normalize(), aL: armL.normalize(), hinge: armHinge,
        },
        leg: {
          l1: legU.length(), l2: legL.length(),
          aU: legU.normalize(), aL: legL.normalize(), hinge: legHinge,
          foot: foot.clone(), footDir: foot.clone().normalize(), footPitch0,
          ballRest: P(`${side}ToeBase`).clone(),
        },
        hand: {
          dir: handDir, palm,
          distalLocal: handDir.clone().applyQuaternion(this.rest[`${side}Hand`].q.clone().invert()),
          extLocal: curlAxis.clone().negate().applyQuaternion(this.rest[`${side}Hand`].q.clone().invert()),
        },
        fingerBones,
      };
    }

    // Ground contacts: [boneA, boneB, t, radius]. Foot radii come from the standing rest pose.
    const footR = (n) => Math.max(P(n).y, 0.01 * k);
    this.contacts = [];
    for (const [side] of SIDES) {
      this.contacts.push(
        [`${side}Foot`, null, 0, footR(`${side}Foot`)],
        [`${side}ToeBase`, null, 0, footR(`${side}ToeBase`)],
        [`${side}Toe_End`, null, 0, footR(`${side}Toe_End`)],
        [`${side}Leg`, null, 0, 0.055 * k],
        [`${side}Hand`, `${side}HandMiddle1`, 0.5, 0.025 * k],
        [`${side}ForeArm`, null, 0, 0.04 * k],
        [`${side}Arm`, null, 0, 0.065 * k]
      );
    }
    this.contacts.push(
      ["Head", "HeadTop_End", 0.45, 0.1 * k],
      ["Spine2", null, 0, 0.12 * k],
      ["Spine", null, 0, 0.11 * k],
      ["Hips", null, 0, 0.11 * k]
    );
    this.contacts = this.contacts.filter(([a, b]) => this.bones[a] && (!b || this.bones[b]));

    this._q = {};
  }

  _modelMatrix(obj) {
    return new THREE.Matrix4().multiplyMatrices(this._modelInv, obj.matrixWorld);
  }

  /** Current model-space position of a bone (valid after _update()). */
  pos(name, out = v3()) {
    return out.setFromMatrixPosition(this.bones[name].matrixWorld).applyMatrix4(this._modelInv);
  }

  _update() {
    this.model.updateWorldMatrix(true, true);
    this._modelInv.copy(this.model.matrixWorld).invert();
  }

  /** Set a bone's model-space orientation, deriving its local rotation from its (driven) parent. */
  _setQ(name, q) {
    const bone = this.bones[name];
    if (!bone) return;
    const parentName = bone.parent?.isBone ? bone.parent.name.replace(/^mixamorig:?/, "") : null;
    const parentQ = (parentName && this._q[parentName]) || this.hipsParentQ;
    bone.quaternion.copy(parentQ.clone().invert().multiply(q));
    this._q[name] = q;
  }

  /** Orientation for a bone that simply follows a rigid rotation of the body frame. */
  _rigid(name, rot) {
    if (this.rest[name]) this._setQ(name, rot.clone().multiply(this.rest[name].q));
  }

  _setLimb(upperName, lowerName, rest, upperDir, lowerDir, hinge) {
    this._setQ(upperName, alignQuat(rest.aU, rest.hinge, upperDir, hinge).multiply(this.rest[upperName].q));
    this._setQ(lowerName, alignQuat(rest.aL, rest.hinge, lowerDir, hinge).multiply(this.rest[lowerName].q));
  }

  /**
   * Apply a full pose.
   * @param {object} p - pose (see exerciseMotions.js for the schema)
   * @param {object} opts - { ground: 'auto'|'none', contacts: string[], anchorXZ: string[], floor: {bone: height} }
   */
  pose(p, opts = {}) {
    this._q = {};
    const root = p.root || {};
    const rootQ = qAxis(Y, root.yaw || 0).multiply(qAxis(X, root.pitch || 0)).multiply(qAxis(Z, root.roll || 0));
    const spineQ = segmentQuat(p.spine);
    const chestQ = rootQ.clone().multiply(spineQ);

    // Pelvis
    this._rigid("Hips", rootQ);
    const hipsPos = this.rest.Hips.pos.clone().add(v3(root.x || 0, root.y || 0, root.z || 0));
    this.bones.Hips.position.copy(hipsPos.clone().applyMatrix4(this.hipsParentInv));

    // Spine, neck, head
    ["Spine", "Spine1", "Spine2"].forEach((n, i) =>
      this._rigid(n, rootQ.clone().multiply(IDENTITY.clone().slerp(spineQ, this.spineSplit[i])))
    );
    const neckQ = segmentQuat(p.neck);
    this._rigid("Neck", chestQ.clone().multiply(IDENTITY.clone().slerp(neckQ, 0.45)));
    this._rigid("Head", chestQ.clone().multiply(neckQ));

    // Clavicles: elevation and retraction
    for (const [side, s] of SIDES) {
      const c = p[`clav${side[0]}`] || {};
      this._rigid(`${side}Shoulder`, chestQ.clone().multiply(qAxis(Y, s * (c.ret || 0))).multiply(qAxis(Z, s * (c.elev || 0))));
    }

    this._update();

    // Legs
    for (const [side, s] of SIDES) {
      const L = this.limbs[side];
      const leg = p[`leg${side[0]}`] || {};
      let thigh, shin, hinge, footDir;

      if (leg.ik) {
        // Planted foot: ball of the foot is the pivot; heel raise lifts the ankle.
        const ball = v3(L.leg.ballRest.x + s * (leg.ball?.[0] || 0), L.leg.ballRest.y + (leg.ball?.[2] || 0), L.leg.ballRest.z + (leg.ball?.[1] || 0));
        let v = L.leg.foot.clone().applyAxisAngle(Y, s * (leg.toeOut || 0) * D2R);
        const flat = v3(v.x, 0, v.z).normalize();
        const liftAxis = Y.clone().cross(flat).normalize();
        v = rotate(v, liftAxis, leg.heel || 0);
        const ankle = ball.clone().sub(v);
        const pole = Z.clone().applyAxisAngle(Y, s * ((leg.toeOut || 0) + (leg.kneeOut || 0)) * D2R);
        ({ upper: thigh, lower: shin, hinge } = solveTwoBone(this.pos(`${side}UpLeg`), ankle, L.leg.l1, L.leg.l2, pole));
        footDir = v.normalize();
      } else {
        const R = qAxis(Z, s * (leg.abd || 0)).multiply(qAxis(X, -(leg.flex || 0)));
        thigh = Y.clone().negate().applyQuaternion(R);
        let ant = Z.clone().applyQuaternion(R);
        ant = rotate(ant, thigh.clone().negate(), s * (leg.rot || 0));
        const bend = ant.clone().negate();
        const kf = (leg.knee || 0) * D2R;
        shin = thigh.clone().multiplyScalar(Math.cos(kf)).add(bend.clone().multiplyScalar(Math.sin(kf)));
        hinge = thigh.clone().cross(bend).normalize();
        [thigh, shin, hinge].forEach((v) => v.applyQuaternion(rootQ));
        const fwd = shin.clone().cross(hinge).normalize();
        const a = L.leg.footPitch0 + (leg.ankle || 0) * D2R;
        footDir = fwd.clone().multiplyScalar(Math.cos(a)).add(shin.clone().negate().multiplyScalar(Math.sin(a)));
        // `flat` (0..1) blends toward a foot planted level on the floor.
        const flatW = +leg.flat || 0;
        const h = v3(fwd.x, 0, fwd.z);
        if (flatW > 0 && h.lengthSq() > 1e-4) {
          const slope = Math.atan2(L.leg.footDir.y, Math.hypot(L.leg.footDir.x, L.leg.footDir.z));
          const planted = h.normalize().multiplyScalar(Math.cos(slope)).add(v3(0, Math.sin(slope), 0));
          footDir.lerp(planted, flatW).normalize();
        }
      }
      this._setLimb(`${side}UpLeg`, `${side}Leg`, L.leg, thigh, shin, hinge);
      const footSide = leg.ik ? Y.clone().cross(v3(footDir.x, 0, footDir.z)).normalize() : hinge;
      this._setQ(`${side}Foot`, alignQuat(L.leg.footDir, L.leg.hinge, footDir, footSide).multiply(this.rest[`${side}Foot`].q));
    }

    const armIK = SIDES.some(([side]) => p[`arm${side[0]}`]?.ik);
    for (const [side] of SIDES) if (!p[`arm${side[0]}`]?.ik) this._poseArm(side, p, chestQ);
    this._update();

    // Grounding / anchoring
    if (opts.ground !== "none") {
      const shift = v3();
      const contacts = opts.contacts ? this.contacts.filter((c) => opts.contacts.includes(c[0])) : this.contacts;
      let minY = Infinity;
      const tmp = v3(), tmp2 = v3();
      for (const [a, b, t, r] of contacts) {
        this.pos(a, tmp);
        if (b) tmp.lerp(this.pos(b, tmp2), t);
        minY = Math.min(minY, tmp.y - r - (opts.floor?.[a] || 0));
      }
      if (Number.isFinite(minY)) shift.y = -minY;
      if (opts.anchorXZ) {
        // Each anchored bone remembers where it first touched down; the pelvis shifts to keep it there.
        this._anchorRefs = this._anchorRefs || {};
        const d = v3();
        for (const n of opts.anchorXZ) {
          const cur = this.pos(n, tmp);
          if (!this._anchorRefs[n]) this._anchorRefs[n] = cur.clone();
          d.add(this._anchorRefs[n]).sub(cur);
        }
        d.divideScalar(opts.anchorXZ.length);
        shift.x = d.x;
        shift.z = d.z;
      }
      if (opts.wallZ !== undefined) {
        let minZ = Infinity;
        for (const n of ["Spine2", "Hips", "Spine1"]) minZ = Math.min(minZ, this.pos(n, tmp).z - 0.12 * (this.height / 1.7));
        shift.z = opts.wallZ - minZ;
      }
      if (shift.lengthSq() > 0) {
        this.bones.Hips.position.copy(hipsPos.add(shift).applyMatrix4(this.hipsParentInv));
        this._update();
      }
    }

    // Planted hands (`plant` 0..1): after the body is placed, pull the FK hand onto the floor
    // with IK, keeping the elbow bending the same way and the palm flat.
    const k = this.height / 1.7;
    const planted = {};
    for (const [side] of SIDES) {
      const arm = p[`arm${side[0]}`];
      const w = arm && !arm.ik ? +arm.plant || 0 : 0;
      if (w <= 0) continue;
      const hand = this.pos(`${side}Hand`), elbow = this.pos(`${side}ForeArm`), shoulder = this.pos(`${side}Arm`);
      const target = hand.clone();
      target.y += (0.04 * k - hand.y) * w;
      const pole = elbow.clone().sub(shoulder.clone().add(hand).multiplyScalar(0.5));
      const fwd = v3(hand.x - elbow.x, 0, hand.z - elbow.z);
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
      planted[side] = {
        ...arm,
        ik: target.toArray(),
        pole: pole.lengthSq() > 1e-8 ? pole.toArray() : undefined,
        palm: w >= 0.5 ? { dir: fwd.normalize().toArray(), normal: [0, -1, 0] } : undefined,
      };
    }

    if (armIK || Object.keys(planted).length) {
      for (const [side] of SIDES) {
        if (planted[side]) this._poseArm(side, p, chestQ, planted[side]);
        else if (p[`arm${side[0]}`]?.ik) this._poseArm(side, p, chestQ);
      }
      this._update();
    }

    this._guard();
  }

  /**
   * Keep the last valid pose. A NaN anywhere in the skeleton makes three.js drop the whole
   * skinned mesh, which looks like the coach vanishing, so fall back instead of rendering it.
   */
  _guard() {
    const bones = Object.values(this.bones);
    if (!this._good) this._good = new Float32Array(bones.length * 7);
    const g = this._good;
    const valid = bones.every((b) => {
      const q = b.quaternion, t = b.position;
      return Number.isFinite(q.x + q.y + q.z + q.w + t.x + t.y + t.z);
    });
    bones.forEach((b, i) => {
      const o = i * 7;
      if (valid) {
        b.quaternion.toArray(g, o);
        b.position.toArray(g, o + 4);
      } else if (this._hasGood) {
        b.quaternion.fromArray(g, o);
        b.position.fromArray(g, o + 4);
      }
    });
    if (valid) this._hasGood = true;
    else this._update();
    return valid;
  }

  /** Reset the XZ anchor so the next pose re-captures where the feet stand. */
  resetAnchor() {
    this._anchorRefs = null;
  }

  _poseArm(side, p, chestQ, override) {
    const L = this.limbs[side];
    const s = L.s;
    const arm = override || p[`arm${side[0]}`] || {};
    let upper, lower, hinge;

    // IK weight: 1 = hand goes to `ik`, 0 = joint angles; in between blends smoothly.
    const w = arm.ik ? THREE.MathUtils.clamp(arm.ikW ?? 1, 0, 1) : 0;
    // rel: "chest" means ik/pole/palm are given in the chest frame, relative to Spine2,
    // so e.g. two hands can meet at the body's midline wherever the body is.
    const toWorld = (vec, isPoint) => {
      const v = v3(...vec);
      if (arm.rel !== "chest") return v;
      v.applyQuaternion(chestQ);
      return isPoint ? v.add(this.pos("Spine2")) : v;
    };

    if (w < 1) {
      const R = qAxis(Z, s * (arm.abd || 0)).multiply(qAxis(X, -(arm.flex || 0)));
      upper = Y.clone().negate().applyQuaternion(R);
      let ant = Z.clone().applyQuaternion(R);
      ant = rotate(ant, upper.clone().negate(), s * (arm.rot || 0));
      const e = (arm.elbow || 0) * D2R;
      lower = upper.clone().multiplyScalar(Math.cos(e)).add(ant.clone().multiplyScalar(Math.sin(e)));
      hinge = upper.clone().cross(ant).normalize();
      [upper, lower, hinge].forEach((v) => v.applyQuaternion(chestQ));
    }
    if (w > 0) {
      const pole = toWorld(arm.pole || [s, -1, -1], false).normalize();
      const ik = solveTwoBone(this.pos(`${side}Arm`), toWorld(arm.ik, true), L.arm.l1, L.arm.l2, pole);
      if (w >= 1) ({ upper, lower, hinge } = ik);
      else {
        upper.lerp(ik.upper, w).normalize();
        lower.lerp(ik.lower, w).normalize();
        hinge.lerp(ik.hinge, w).normalize();
      }
    }
    this._setLimb(`${side}Arm`, `${side}ForeArm`, L.arm, upper, lower, hinge);

    // Hand: either a world orientation (palm on floor / bar grip) or pronation + wrist extension.
    const foreQ = this._q[`${side}ForeArm`];
    const handRest = this.rest[`${side}Hand`];
    const neutral = foreQ.clone().multiply(this.rest[`${side}ForeArm`].q.clone().invert()).multiply(handRest.q);
    let target = neutral
      .clone()
      .multiply(qAxis(L.hand.distalLocal, s * (arm.pron || 0)))
      .multiply(qAxis(L.hand.extLocal, arm.wrist || 0));
    if (arm.palm) {
      const palmW = arm.ik ? w : 1;
      const palmQ = alignQuat(L.hand.dir, L.hand.palm, toWorld(arm.palm.dir, false), toWorld(arm.palm.normal, false)).multiply(handRest.q);
      target = palmW >= 1 ? palmQ : target.slerp(palmQ, palmW);
    }
    // Share the forearm twist between the forearm and the wrist so the skin doesn't candy-wrap.
    const delta = target.clone().multiply(neutral.clone().invert());
    const axis = lower.clone().normalize();
    const proj = v3(delta.x, delta.y, delta.z).dot(axis);
    const twist = 2 * Math.atan2(proj, delta.w);
    const foreTwisted = new THREE.Quaternion().setFromAxisAngle(axis, twist * 0.5).multiply(foreQ);
    this._setQ(`${side}ForeArm`, foreTwisted);
    this._setQ(`${side}Hand`, target);

    const curl = arm.fingers ?? p.fingers ?? 0.3;
    for (const f of L.fingerBones) {
      const bone = this.bones[f.name];
      // `thumb` overrides the thumb's curl, e.g. 0 keeps it alongside the index finger on a bar.
      const c = f.thumb && arm.thumb !== undefined ? arm.thumb / f.weight : curl;
      const amount = c * f.weight * (f.joint === 1 ? 55 : 70);
      bone.quaternion.copy(this.rest[f.name].local).multiply(qAxis(f.axisLocal, amount));
    }
  }
}
