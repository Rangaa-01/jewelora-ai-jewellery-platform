// Copies the MediaPipe Tasks Vision WASM runtime into public/ so it is served same-origin
// (no CDN dependency, works under the strict Content-Security-Policy and offline shell).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = join(root, "public", "mediapipe", "wasm");
if (!existsSync(src)) {
  console.error("@mediapipe/tasks-vision is not installed; run npm install first.");
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`MediaPipe WASM copied to ${dest}`);
