import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import AvatarRig from "./AvatarRig.js";
import { MOTIONS, mirrorPose } from "./exerciseMotions.js";
import { cueKey } from "./coachI18n.js";

const THEMES = {
  dark: { bg: 0x16181d, floor: 0x1d2027, ring: 0x3f51b5, mat: 0x3949ab, prop: 0x8d99ae, wall: 0x2a2e37 },
  light: { bg: 0xeef0f4, floor: 0xe3e6ec, ring: 0xf57c00, mat: 0xf57c00, prop: 0x5c6470, wall: 0xd9dde4 },
};

const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

/** Blend two poses. Numbers (and booleans, as 0/1) interpolate; other values switch to the target. */
function lerpPose(a, b, t) {
  if (typeof a === "boolean" || typeof b === "boolean") {
    const na = +(a ?? 0), nb = +(b ?? 0);
    return na === nb ? b : na + (nb - na) * t;
  }
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * t;
  if (Array.isArray(a) && Array.isArray(b) && typeof b[0] === "number") return b.map((v, i) => (a[i] ?? v) + (v - (a[i] ?? v)) * t);
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(b)) {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      out[k] = k in a && k in b ? lerpPose(a[k], b[k], t) : k in b ? b[k] : a[k];
    }
    return out;
  }
  return t > 0 ? b ?? a : a ?? b;
}

/**
 * Plays a looping exercise timeline: eases between key poses, reports cues and completed reps.
 */
class MotionPlayer {
  constructor(keys) {
    this.keys = keys;
    this.segments = [];
    let t = 0;
    keys.forEach((k, i) => {
      const from = keys[(i - 1 + keys.length) % keys.length];
      this.segments.push({ from, to: k, start: t, move: k.move ?? 1, hold: k.hold ?? 0 });
      t += (k.move ?? 1) + (k.hold ?? 0);
    });
    this.duration = t;
  }

  sample(time) {
    const t = ((time % this.duration) + this.duration) % this.duration;
    const seg = this.segments.find((s) => t < s.start + s.move + s.hold) || this.segments[this.segments.length - 1];
    const local = t - seg.start;
    const alpha = local >= seg.move ? 1 : easeInOut(local / seg.move);
    const pose = lerpPose(seg.from.pose, seg.to.pose, alpha);
    // Only bones planted at both ends of a transition may stay anchored while it plays.
    const a = seg.from.pose.anchor, b = seg.to.pose.anchor;
    if (a && b && alpha < 1) {
      const both = b.filter((n) => a.includes(n));
      pose.anchor = both.length ? both : a;
    }
    return { pose, key: seg.to, index: this.segments.indexOf(seg) };
  }

  /** Number of rep keys reached between two times. */
  repsBetween(t0, t1) {
    let reps = 0;
    const loops = Math.floor(t1 / this.duration) - Math.floor(t0 / this.duration);
    const perLoop = this.segments.filter((s) => s.to.rep).length;
    reps += Math.max(0, loops - 1) * perLoop;
    const mark = (t) => {
      const base = Math.floor(t / this.duration) * this.duration;
      return this.segments.filter((s) => s.to.rep && base + s.start + s.move <= t).length;
    };
    if (loops === 0) return mark(t1) - mark(t0);
    return reps + (perLoop - mark(t0)) + mark(t1);
  }
}

/**
 * AvatarScene - renders the 3D coach performing an exercise in a canvas inside `container`.
 */
export default class AvatarScene {
  constructor(container, { modelUrl = "/models/coach.glb", dark = true, onCue, onRep, onReady, onError, onContextChange } = {}) {
    this.container = container;
    this.avatar = { url: modelUrl, range: 1 };
    this.callbacks = { onCue, onRep, onReady, onError, onContextChange };
    this.contextLost = false;
    this.theme = dark ? THEMES.dark : THEMES.light;
    this.speed = 1;
    this.playing = true;
    this.mirror = false;
    this.time = 0;
    this.lastCue = null;
    this.disposed = false;
    this.insets = { top: 0, bottom: 0 };
    // The camera feed and pose tracking want the GPU far more than the coach does, so the coach
    // draws at a steady 30fps, and not at all while it is off-screen or the tab is in the background.
    this.fpsCap = 30;
    this._frameDebt = 0;
    this._inView = true;
    this.losses = 0;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this._buildEnvironment();
    this.scene.environmentIntensity = 0.45;

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.maxPolarAngle = Math.PI * 0.53;
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 12;
    this.renderer.domElement.addEventListener("dblclick", () => this.frame());

    // Browsers drop WebGL contexts under memory pressure or when too many are open (MediaPipe
    // uses some too). Without handling this the coach just vanishes; instead, pause rendering
    // and rebuild GPU-side resources when the context comes back.
    this._onLost = (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.losses++;
      this.callbacks.onContextChange?.(true);
    };
    this._onRestored = () => {
      this.contextLost = false;
      // Coming back at full quality into the same memory pressure just loses the context again,
      // so a coach that keeps being dropped comes back lighter instead.
      if (this.losses >= 2) {
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
        this.scene.traverse((o) => {
          if (o.material) o.material.needsUpdate = true;
        });
        this.fpsCap = 24;
      }
      this._buildEnvironment();
      this.resize();
      this.callbacks.onContextChange?.(false);
    };
    this.renderer.domElement.addEventListener("webglcontextlost", this._onLost);
    this.renderer.domElement.addEventListener("webglcontextrestored", this._onRestored);

    this._buildStage();
    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(container);
    this._inViewObserver = new IntersectionObserver(([entry]) => {
      this._inView = entry.isIntersecting;
    });
    this._inViewObserver.observe(container);
    this.resize();

    this.clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  _buildEnvironment() {
    this.envTexture?.dispose();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTexture;
  }

  _buildStage() {
    const th = this.theme;
    this.scene.background = new THREE.Color(th.bg);
    this.scene.fog = new THREE.Fog(th.bg, 9, 22);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444a55, 0.9);
    this.scene.add(this.hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2.2, 4.5, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 3.5, bottom: -1.5, near: 0.5, far: 14 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    this.scene.add(key, key.target);
    this.keyLight = key;

    const rim = new THREE.DirectionalLight(0xbfd4ff, 1.1);
    rim.position.set(-3, 3, -3.5);
    this.scene.add(rim);

    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(12, 64),
      new THREE.MeshStandardMaterial({ color: th.floor, roughness: 0.95, metalness: 0 })
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.09, 96),
      new THREE.MeshBasicMaterial({ color: th.ring, transparent: true, opacity: 0.55 })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.002;
    this.scene.add(this.ring);

    this.props = new THREE.Group();
    this.scene.add(this.props);
  }

  setDark(dark) {
    this.theme = dark ? THEMES.dark : THEMES.light;
    this.scene.background.set(this.theme.bg);
    this.scene.fog.color.set(this.theme.bg);
    this.floor.material.color.set(this.theme.floor);
    this.ring.material.color.set(this.theme.ring);
    if (this.exerciseKey) this._buildProps();
  }

  async load() {
    const token = (this._loadToken = (this._loadToken || 0) + 1);
    try {
      const gltf = await new GLTFLoader().loadAsync(this.avatar.url);
      // Ignore a load that finished after the scene was disposed or another avatar was chosen.
      if (this.disposed || token !== this._loadToken) {
        this._disposeObject(gltf.scene);
        return;
      }
      this._removeModel();
      this.model = gltf.scene;
      this.model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = false;
          if (o.material) o.material.envMapIntensity = 0.8;
        }
      });
      this.rig = new AvatarRig(this.model, gltf.animations);
      this._hand = this._measureHand();
      this.scene.add(this.model);
      if (this.exerciseKey) this.setExercise(this.exerciseKey, true);
      this.callbacks.onReady?.();
    } catch (err) {
      console.error("AvatarScene: failed to load coach model", err);
      this.callbacks.onError?.(err);
    }
  }

  /**
   * Switch the coach character. `avatar` is { url, range } (see avatars.js); changing only the
   * range re-plays the current exercise, changing the url loads the new character.
   */
  setAvatar(avatar) {
    const urlChanged = avatar.url !== this.avatar.url;
    this.avatar = { range: 1, ...avatar };
    if (urlChanged || !this.model) return this.load();
    if (this.exerciseKey) this.setExercise(this.exerciseKey, true);
    return Promise.resolve();
  }

  /**
   * World positions of the posed, skinned mesh (every `stride`-th vertex), each tagged with the
   * bone that mostly drives it. Bones sit inside the body, so props are fitted against these
   * surface points instead: the seat meets the thighs, the backrest meets the back, the bar meets
   * the palms.
   */
  _surface(bonePattern, stride = 3) {
    if (!this._skinMeshes) {
      this._skinMeshes = [];
      this.model.traverse((o) => {
        if (!o.isSkinnedMesh) return;
        const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight;
        const bones = new Array(si.count);
        for (let i = 0; i < si.count; i++) {
          let best = 0, bw = -1;
          for (let c = 0; c < 4; c++) {
            const w = sw.getComponent(i, c);
            if (w > bw) {
              bw = w;
              best = si.getComponent(i, c);
            }
          }
          bones[i] = o.skeleton.bones[best].name.replace(/^mixamorig:?/, "");
        }
        this._skinMeshes.push({ mesh: o, bones });
      });
    }
    const pts = [];
    for (const { mesh, bones } of this._skinMeshes) {
      mesh.updateMatrixWorld();
      for (let i = 0; i < bones.length; i += stride) {
        if (bonePattern && !bonePattern.test(bones[i])) continue;
        pts.push(mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
      }
    }
    return pts;
  }

  _removeModel() {
    this._skinMeshes = null;
    if (!this.model) return;
    this.scene.remove(this.model);
    this._disposeObject(this.model);
    this.model = null;
    this.rig = null;
  }

  _disposeObject(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry?.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        Object.values(m || {}).forEach((v) => v?.isTexture && v.dispose());
        m?.dispose();
      });
    });
  }

  /**
   * Adapt authored keys to the current character: scale absolute pelvis/foot offsets to its
   * height (motions were authored on a 1.586 m character) and apply the avatar's range, which
   * moves every key part of the way back toward the exercise's starting pose.
   */
  _adaptKeys(keys) {
    const scale = this.rig.height / 1.586;
    if (Math.abs(scale - 1) > 0.01) {
      // Keys can share a pose object, so scale each pose only once.
      for (const pose of new Set(keys.map((k) => k.pose))) {
        const r = pose.root;
        if (r) ["x", "y"].forEach((a) => r[a] !== undefined && (r[a] *= scale));
        for (const leg of [pose.legL, pose.legR]) if (leg?.ball) leg.ball = leg.ball.map((v) => v * scale);
      }
    }
    const range = this.motion.seniorRange ?? this.avatar.range ?? 1;
    if (range >= 1 || keys.length < 2) return keys;
    const start = keys[0].pose;
    return keys.map((k, i) => (i === 0 ? k : { ...k, pose: lerpPose(start, k.pose, range) }));
  }

  /**
   * Hand size from the mesh in its rest pose: wrist-to-knuckle length and how far the palm
   * surface sits from the hand bone. Grips and joined palms scale with these, since hand size
   * varies between characters more than body height does.
   */
  _measureHand() {
    const r = this.rig, L = r.limbs.Left.hand;
    const wrist = r.rest.LeftHand.pos;
    const pts = this._surface(/^LeftHand$/, 1);
    const palm = pts.length ? Math.max(...pts.map((p) => p.clone().sub(wrist).dot(L.palm))) : 0.027;
    return { len: r.rest.LeftHandMiddle1.pos.distanceTo(wrist), palm };
  }

  _metrics() {
    const r = this.rig;
    return {
      hand: this._hand,
      height: r.height,
      shoulderY: r.rest.LeftArm.pos.y,
      shoulderX: r.rest.LeftArm.pos.x,
      armReach: r.limbs.Left.arm.l1 + r.limbs.Left.arm.l2,
    };
  }

  setExercise(key, force = false) {
    if (!force && key === this.exerciseKey) return;
    this.exerciseKey = key;
    this.motion = MOTIONS[key];
    if (!this.rig || !this.motion) return;

    const ctx = {
      m: this._metrics(),
      // Measure where the hands land in an FK pose, so IK can keep them planted there.
      plantHands: (pose, { opts }) => {
        this.rig.resetAnchor();
        this.rig.pose(pose, opts);
        const k = this.rig.height / 1.7;
        const hand = (side) => {
          const p = this.rig.pos(`${side}Hand`);
          return [p.x, 0.045 * k, p.z];
        };
        const res = { L: hand("Left"), R: hand("Right") };
        res.floorGap = Math.min(this.rig.pos("LeftHand").y, this.rig.pos("RightHand").y) - 0.045 * k;
        this.rig.resetAnchor();
        return res;
      },
      /**
       * Nudge a grip so the hands wrap the bar without sinking into it: try small wrist offsets
       * (up, forward) on `build(du, dz)`'s pose and score the real hand surface against the bar.
       */
      fitGrip: (bar, build) => {
        let best = { score: Infinity, du: 0, dz: 0 };
        for (let du = -0.03; du <= 0.0301; du += 0.01) {
          for (let dz = -0.03; dz <= 0.0301; dz += 0.01) {
            const pose = build(du, dz);
            this.rig.pose(pose, this._opts(pose));
            let minD = Infinity;
            for (const p of this._surface(/^(Left|Right)Hand/, 2)) {
              if (Math.abs(p.x) > bar.width / 2) continue;
              minD = Math.min(minD, Math.hypot(p.y - bar.y, p.z - bar.z) - 0.016);
            }
            // Penetration is worst; floating off the bar is next; then prefer small nudges.
            const score = Math.max(0, -minD - 0.002) * 20 + Math.max(0, minD - 0.004) * 5 + Math.hypot(du, dz) * 0.2;
            if (score < best.score) best = { score, du, dz };
          }
        }
        return [best.du, best.dz];
      },
      /**
       * Move a pose's body back (−z) until the given body parts clear the bar by `gap` metres,
       * measured on the real mesh, so bigger characters don't clip the bar with head or hips.
       */
      blend: (a, b, t) => lerpPose(a, b, t),
      /**
       * Joined palms: choose the fingertip tilt at which the two hands' fingers meet at the
       * midline, neither gapping (a V) nor passing through each other. Fingers rest at a
       * different curl on every character, so this is measured rather than fixed.
       */
      fitJoin: (build) => {
        // Gap (+) or overlap (−) between the two hands' surfaces across the midline.
        const gap = (lp, rp) => {
          const l = this._surface(lp, 3), r = this._surface(rp, 3);
          return l.length && r.length ? Math.min(...l.map((p) => p.x)) - Math.max(...r.map((p) => p.x)) : 0;
        };
        const cost = (g) => (g < -0.003 ? (-0.003 - g) * 3 : Math.max(0, g + 0.003));
        let best = { score: Infinity, tilt: 0.12, fingers: 0 };
        for (const fingers of [0, -0.1, -0.2, -0.3]) {
          for (let tilt = -0.3; tilt <= 0.401; tilt += 0.05) {
            const pose = build(tilt, fingers);
            this.rig.pose(pose, this._opts(pose));
            const fingerGap = gap(/^LeftHand(Index|Middle|Ring|Pinky)/, /^RightHand(Index|Middle|Ring|Pinky)/);
            const palmGap = gap(/^LeftHand$/, /^RightHand$/);
            const score = cost(fingerGap) + cost(palmGap) + Math.abs(fingers) * 0.01;
            if (score < best.score) best = { score, tilt, fingers };
          }
        }
        return best;
      },
      clearBar: (bar, pose, pattern, gap) => {
        for (let i = 0; i < 8; i++) {
          this.rig.pose(pose, this._opts(pose));
          let minD = Infinity;
          for (const p of this._surface(pattern, 2)) {
            if (Math.abs(p.x) > bar.width / 2) continue;
            minD = Math.min(minD, Math.hypot(p.y - bar.y, p.z - bar.z) - 0.016);
          }
          if (minD >= gap) break;
          pose.root.z = (pose.root.z || 0) - (gap - minD) - 0.002;
        }
        return pose;
      },
      // Height of a bone above the floor in a pose (used to solve body angles for floor contact).
      // Position of a bone in a pose, e.g. to place hands on a wall in front of the shoulders.
      bonePos: (pose, opts, name) => {
        this.rig.resetAnchor();
        this.rig.pose(pose, opts);
        const p = this.rig.pos(name).toArray();
        this.rig.resetAnchor();
        return p;
      },
      boneY: (pose, opts, name) => {
        this.rig.resetAnchor();
        this.rig.pose(pose, opts);
        const y = this.rig.pos(name).y;
        this.rig.resetAnchor();
        return y;
      },
      // Put the back against the wall using the real body surface. If the head would touch the
      // wall before the back does, tuck the chin a little (hair may press in slightly).
      alignToWall: (poses) => {
        const wallZ = -0.3;
        const minZ = (pts) => Math.min(...pts.map((p) => p.z));
        for (const p of poses) {
          const hairGive = 0.035 * (this.rig.height / 1.7);
          let back, head;
          for (let i = 0; i < 6; i++) {
            this.rig.pose(p, { ground: "none" });
            back = minZ(this._surface(/^(Hips|Spine|Spine1|Spine2|LeftShoulder|RightShoulder)$/));
            head = minZ(this._surface(/^(Neck|Head|HeadTop_End)$/));
            if (head + hairGive >= back - 0.003) break;
            p.neck = { ...p.neck, flex: (p.neck?.flex || 0) + 4 };
          }
          p.root.z = (p.root.z || 0) + wallZ + 0.002 - Math.min(back, head + hairGive);
        }
        ctx.wall = { z: wallZ };
      },
    };
    const keys = this._adaptKeys(this.motion.keys(ctx));
    this.ctx = ctx;
    this.player = new MotionPlayer(this.mirror ? keys.map((k) => ({ ...k, pose: mirrorPose(k.pose) })) : keys);
    this.time = 0;
    this.lastCue = null;
    this.rig.resetAnchor();
    // Record where each anchored foot stands by visiting the key poses in order.
    for (const k of this.player.keys) this.rig.pose(k.pose, this._opts(k.pose));
    this._applyPose(0);
    this._buildProps();
    this.frame();
  }

  setMirror(mirror) {
    if (mirror === this.mirror) return;
    this.mirror = mirror;
    if (this.exerciseKey) this.setExercise(this.exerciseKey, true);
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  setPlaying(playing) {
    this.playing = playing;
  }

  restart() {
    this.time = 0;
  }

  /** Jump to a time (seconds) and render immediately; used for previews and tests. */
  seek(t) {
    this.time = t;
    this._applyPose(0);
    this._updateFog();
    this.renderer.render(this.scene, this.camera);
  }

  _opts(pose) {
    return pose.anchor ? { ...this.motion.opts, anchorXZ: pose.anchor } : this.motion.opts;
  }

  _applyPose(dt) {
    if (!this.player) return;
    const prev = this.time;
    if (this.playing) this.time += dt * this.speed;
    const { pose, key } = this.player.sample(this.time);

    // Subtle breathing so the coach never looks frozen during holds.
    const breath = Math.sin((this.time * Math.PI * 2) / 4.2);
    const live = {
      ...pose,
      spine: { ...pose.spine, flex: (pose.spine?.flex || 0) - 1.1 * breath },
      clavL: { ...pose.clavL, elev: (pose.clavL?.elev || 0) + 1.2 * breath },
      clavR: { ...pose.clavR, elev: (pose.clavR?.elev || 0) + 1.2 * breath },
    };
    this.rig.pose(live, this._opts(pose));

    if (cueKey(key.cue) !== this.lastCue) {
      this.lastCue = cueKey(key.cue);
      this.callbacks.onCue?.(key.cue);
    }
    if (dt > 0 && this.playing) {
      const reps = this.player.repsBetween(prev, this.time);
      if (reps > 0) this.callbacks.onRep?.(reps);
    }
  }

  /** Bounding box of the coach across the whole timeline; focus 'upper' = head & shoulders, 'torso' = waist up. */
  _motionBounds(focus) {
    const box = new THREE.Box3();
    const all = Object.keys(this.rig.bones);
    const names =
      focus === "upper"
        ? ["Head", "HeadTop_End", "Neck", "LeftArm", "RightArm", "Spine2", "LeftShoulder", "RightShoulder"]
        : focus === "torso"
        ? all.filter((n) => !/Leg|Foot|Toe|Hand./.test(n))
        : all;
    const saved = this.time;
    const steps = 36;
    for (let i = 0; i < steps; i++) {
      this.time = (i / steps) * this.player.duration;
      const { pose } = this.player.sample(this.time);
      this.rig.pose(pose, this._opts(pose));
      for (const n of names) box.expandByPoint(this.rig.pos(n));
    }
    this.time = saved;
    const pad = focus ? 0.1 : 0.08;
    box.expandByVector(new THREE.Vector3(pad, pad, pad));
    if (!focus) box.min.y = Math.min(box.min.y, 0);
    return box;
  }

  /** Point the camera at the exercise from its preferred angle, fitting the whole motion. */
  frame() {
    if (!this.rig || !this.player) return;
    const view = this.motion.view || { az: 30, el: 8 };
    const box = this._motionBounds(view.focus);
    if (this.ctx?.bar) box.expandByPoint(new THREE.Vector3(0, this.ctx.bar.y + 0.15, this.ctx.bar.z));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const az = ((this.mirror ? -view.az : view.az) * Math.PI) / 180;
    const el = (view.el * Math.PI) / 180;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));

    // Fit the box's projected extent into both the vertical and horizontal field of view.
    const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    const halfW = (Math.abs(right.x) * size.x + Math.abs(right.z) * size.z) / 2;
    const halfH = size.y / 2 + Math.abs(Math.sin(el)) * Math.max(size.x, size.z) * 0.25;
    // Only the part of the canvas not covered by overlays (insets) is used for framing.
    const h = this.container.clientHeight || 1;
    const usable = Math.max(0.3, 1 - (this.insets.top + this.insets.bottom) / h);
    const vFov = Math.atan(Math.tan((this.camera.fov * Math.PI) / 360) * usable);
    const hFov = Math.atan(Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect);
    const depth = Math.abs(dir.x) * size.x / 2 + Math.abs(dir.z) * size.z / 2;
    const dist = Math.max(halfH / Math.tan(vFov), halfW / Math.tan(hFov)) * 1.04 + depth * 0.5;

    this.controls.maxDistance = Math.max(12, dist * 1.8);
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(dir, dist);
    this.camera.near = 0.05;
    this.camera.far = dist + 30;
    this.camera.updateProjectionMatrix();
    this.controls.update();

    this.keyLight.target.position.copy(center).setY(0);
    this.keyLight.position.copy(center).add(new THREE.Vector3(2.2, 4.5, 3.2));
    this.ring.position.set(center.x, 0.002, center.z);
    const radius = Math.max(0.8, Math.hypot(size.x, size.z) / 2 + 0.15);
    this.ring.scale.setScalar(radius / 1.07);
  }

  _buildProps() {
    // Prop geometry in world space, for contact checks (see tests) and debugging.
    this.propInfo = {};
    this.props.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    this.props.clear();
    const props = this.motion?.props || [];
    if (!this.rig || !props.length) return;
    const th = this.theme;
    const k = this.rig.height / 1.7;
    const std = (color, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.props.add(m);
      return m;
    };

    if (props.includes("mat")) {
      const box = this._motionBounds();
      const c = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const along = size.z >= size.x;
      const mat = add(new THREE.BoxGeometry(0.64 * k, 0.012, Math.max(1.85 * k, (along ? size.z : size.x) + 0.1)), std(th.mat, 0.85), c.x, 0.006, c.z);
      if (!along) mat.rotation.y = Math.PI / 2;
      mat.castShadow = false;
    }

    if (props.includes("chair")) {
      // Fit the chair to the seated body: seat top under the lowest point of the buttocks and
      // thighs, backrest face against the back.
      const seated = this.player.keys[0].pose;
      this.rig.pose(seated, this._opts(seated));
      const hips = this.rig.pos("Hips");
      const w = 0.46 * k;
      let d = 0.44 * k;
      const lower = this._surface(/^(Hips|LeftUpLeg|RightUpLeg)$/, 2).filter(
        (p) => Math.abs(p.x - hips.x) < w / 2 && p.z > hips.z - 0.3 * k && p.z < hips.z + 0.25 * k
      );
      const seatY = Math.min(...lower.map((p) => p.y));
      const back = this._surface(/^(Hips|Spine|Spine1|Spine2)$/, 2).filter(
        (p) => Math.abs(p.x - hips.x) < w / 2 && p.y > seatY + 0.12 * k && p.y < seatY + 0.42 * k
      );
      const backZ = Math.min(...back.map((p) => p.z)) - 0.004;
      const knee = Math.min(this.rig.pos("LeftLeg").z, this.rig.pos("RightLeg").z);
      d = Math.min(d, knee - backZ - 0.1 * k);
      const cz = backZ + d / 2, legH = seatY - 0.04;
      const wood = std(th.prop, 0.55, 0.1);
      add(new THREE.BoxGeometry(w, 0.04, d), wood, hips.x, seatY - 0.02, cz);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        add(new THREE.CylinderGeometry(0.018, 0.018, legH, 12), wood, hips.x + (sx * w) / 2.3, legH / 2, cz + (sz * d) / 2.3);
      }
      // Backrest: its front face sits exactly at backZ, starting a little above the seat.
      const backH = 0.3 * k;
      add(new THREE.BoxGeometry(w, backH, 0.03), wood, hips.x, seatY + 0.12 * k + backH / 2, backZ - 0.015);
      for (const sx of [-1, 1]) {
        add(new THREE.BoxGeometry(0.03, 0.12 * k, 0.03), wood, hips.x + (sx * (w - 0.03)) / 2, seatY + 0.06 * k, backZ - 0.015);
      }
      this.propInfo.seat = { top: seatY, x: hips.x, z: cz, w, d, backZ };
    }

    if (props.includes("wall") && this.ctx?.wall) {
      add(new THREE.BoxGeometry(3.2, 2.6, 0.1), std(th.wall, 0.95), 0, 1.3, this.ctx.wall.z - 0.05);
      this.propInfo.wall = { z: this.ctx.wall.z };
    }

    // A wall in front of the coach (wall push-ups); ctx.wallFront.z is its front face.
    if (props.includes("wallFront") && this.ctx?.wallFront) {
      add(new THREE.BoxGeometry(3.2, 2.6, 0.1), std(th.wall, 0.95), 0, 1.3, this.ctx.wallFront.z + 0.05);
      this.propInfo.wallFront = { z: this.ctx.wallFront.z };
    }

    if (props.includes("bar") && this.ctx?.bar) {
      const { y, z, width } = this.ctx.bar;
      const steel = std(0xc9ced6, 0.25, 0.9);
      const post = std(0x2f3540, 0.5, 0.4);
      const bar = add(new THREE.CylinderGeometry(0.016, 0.016, width + 0.1, 20), steel, 0, y, z);
      bar.rotation.z = Math.PI / 2;
      this.propInfo.bar = { y, z, r: 0.016, width };
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.06, y + 0.08, 0.06), post, (sx * (width + 0.16)) / 2, (y + 0.08) / 2, z);
    }
  }

  /** Reserve space (px) covered by UI overlays so the coach is framed in the visible area. */
  setInsets(top = 0, bottom = 0) {
    this.insets = { top, bottom };
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return; // hidden or not laid out yet; the ResizeObserver will call again
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const { top, bottom } = this.insets;
    if (top || bottom) this.camera.setViewOffset(w, h, 0, (bottom - top) / 2, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    if (this.player) this.frame();
  }

  /** Keep the fog behind the coach at any zoom level, so it only softens the horizon. */
  _updateFog() {
    const d = this.camera.position.distanceTo(this.controls.target);
    this.scene.fog.near = d + 4;
    this.scene.fog.far = d + 18;
  }

  _loop() {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.contextLost || document.hidden || !this._inView) return;
    // Skipped frames still count towards the motion, so the coach keeps time either way.
    this._frameDebt += dt;
    if (this._frameDebt < 1 / this.fpsCap) return;
    const step = this._frameDebt;
    this._frameDebt = 0;
    if (this.rig) this._applyPose(step);
    this.controls.update();
    this._updateFog();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this._raf);
    this._resizeObserver?.disconnect();
    this.controls.dispose();
    this._inViewObserver?.disconnect();
    this.scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          Object.values(m || {}).forEach((v) => v?.isTexture && v.dispose());
          m?.dispose();
        });
      }
    });
    this.envTexture.dispose();
    this.renderer.domElement.removeEventListener("webglcontextlost", this._onLost);
    this.renderer.domElement.removeEventListener("webglcontextrestored", this._onRestored);
    this.renderer.dispose();
    // Release the GPU context now instead of waiting for GC, so remounting the coach
    // (show/hide, switching exercises) never pushes the browser over its context limit.
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
