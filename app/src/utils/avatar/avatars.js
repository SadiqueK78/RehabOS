/**
 * Coach characters. Any Mixamo-rigged .glb works: AvatarRig measures the skeleton itself.
 *
 * `range` scales how far each movement goes from its starting position (1 = full range) and
 * `speed` is the default playback speed. The senior coach demonstrates a gentler, slower
 * version that is safer for older adults to follow. Exercises can opt out with
 * `seniorRange: 1` in exerciseMotions.js when a reduced range would break the pose
 * (e.g. the tree-pose foot must still reach the thigh).
 */
const PUBLIC = process.env.PUBLIC_URL || "";

export const AVATARS = [
  { id: "adult", url: `${PUBLIC}/models/coach.glb`, labelKey: "avatarAdult", range: 1, speed: 1 },
  { id: "senior", url: `${PUBLIC}/models/coach-senior.glb`, labelKey: "avatarSenior", range: 0.8, speed: 0.75, optional: true },
];

export const getAvatar = (id) => AVATARS.find((a) => a.id === id) || AVATARS[0];

/**
 * Optional avatars only appear when their model file has been added to public/models.
 *
 * Checked with a GET for the first bytes (not HEAD): the CRA dev server forwards HEAD requests
 * to the `proxy` backend, and SPA hosts (Firebase rewrites, `serve -s`) answer missing files
 * with index.html, so the only reliable test is the glTF binary signature "glTF".
 */
export async function avatarAvailable(avatar) {
  if (!avatar.optional) return true;
  const controller = new AbortController();
  try {
    const res = await fetch(avatar.url, { headers: { Range: "bytes=0-11" }, signal: controller.signal });
    if (!res.ok || !res.body) return false;
    const { value } = await res.body.getReader().read();
    return !!value && value.length >= 4 && String.fromCharCode(...value.slice(0, 4)) === "glTF";
  } catch {
    return false;
  } finally {
    controller.abort(); // stop the download if the server ignored the Range header
  }
}
