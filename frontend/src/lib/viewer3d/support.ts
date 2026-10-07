/** Device capability checks for the 3D viewer (client only). */

export function supportsWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Heuristic for skipping decorative effects (sparkles, auto-rotate) on weak devices. */
export function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return true;
  const cores = navigator.hardwareConcurrency ?? 2;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return cores <= 4 || (memory !== undefined && memory <= 2);
}

export function supportsFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  return typeof document.documentElement.requestFullscreen === "function";
}
