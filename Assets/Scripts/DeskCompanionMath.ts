/**
 * DeskCompanionMath — tiny shared math helpers (no scene access, no state beyond a cached sign).
 *
 * yawQuat() returns a rotation about world up that turns a model whose front is local
 * -Z (or +Z) toward a horizontal direction. The rotation-direction convention of
 * quat.angleAxis is probed once at runtime instead of being assumed, so the result is
 * correct either way.
 */

let yawSign = 0

function probeYawSign(): number {
  if (yawSign !== 0) return yawSign
  // Where does +90deg about up send local -Z?
  const v = quat.angleAxis(Math.PI / 2, vec3.up()).multiplyVec3(new vec3(0, 0, -1))
  // Standard right-handed rotation sends -Z to -X. If we get +X the convention is flipped.
  yawSign = v.x < 0 ? 1 : -1
  return yawSign
}

/**
 * Rotation about world up so a model whose front is local -Z faces `dir` (flattened).
 * `extraYawDeg` is added on top (e.g. 180 for models authored facing +Z).
 */
export function yawQuat(dir: vec3, extraYawDeg: number = 0): quat {
  const s = probeYawSign()
  const flat = new vec3(dir.x, 0, dir.z)
  const len = flat.length
  const n = len > 0.0001 ? flat.uniformScale(1 / len) : new vec3(0, 0, -1)
  // standard convention: front(-Z) rotated by a = (-sin a, 0, -cos a)
  const a = Math.atan2(-n.x, -n.z) * s
  return quat.angleAxis(a + (extraYawDeg * Math.PI) / 180 * s, vec3.up())
}

/** Yaw angle (radians, in the same convention as yawQuat) for a -Z-front model facing `dir`. */
export function yawAngle(dir: vec3): number {
  const s = probeYawSign()
  return Math.atan2(-dir.x, -dir.z) * s
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Shortest signed difference between two angles (radians), result in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d <= -Math.PI) d += Math.PI * 2
  return d
}

export function smoothStep01(t: number): number {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

export function degToRad(d: number): number {
  return (d * Math.PI) / 180
}
