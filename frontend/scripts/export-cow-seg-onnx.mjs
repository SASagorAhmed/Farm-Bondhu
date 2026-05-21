#!/usr/bin/env node
/**
 * Export YOLOv8n-seg to ONNX for browser cow outline (COCO class 19 = cow).
 * Requires Python 3 with: pip install ultralytics onnx
 *
 * Usage (from frontend/): npm run cow:models:seg
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = resolve(__dirname, "..");
const OUT_DIR = join(FRONTEND_ROOT, "public", "models");
const OUT_FILE = join(OUT_DIR, "yolov8n-seg.onnx");
const MIN_BYTES = 1_000_000;

function log(msg) {
  console.log(`[cow:models:seg] ${msg}`);
}

function fail(msg, code = 1) {
  console.error(`[cow:models:seg] ERROR: ${msg}`);
  process.exit(code);
}

function findPython() {
  const candidates = process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"];
  for (const cmd of candidates) {
    const r = spawnSync(cmd, ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
    if (r.status === 0) return cmd;
  }
  return null;
}

function run(cmd, args, opts = {}) {
  log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? FRONTEND_ROOT,
    encoding: "utf8",
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...opts.env },
  });
  if (r.status !== 0) {
    fail(`Command failed (exit ${r.status ?? "unknown"}): ${cmd} ${args.join(" ")}`);
  }
}

function findExportedOnnx(searchDirs) {
  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;
    const names = readdirSync(dir).filter((n) => n.endsWith(".onnx") && n.includes("seg"));
    for (const name of names) {
      const p = join(dir, name);
      if (statSync(p).size >= MIN_BYTES) return p;
    }
    const exact = join(dir, "yolov8n-seg.onnx");
    if (existsSync(exact) && statSync(exact).size >= MIN_BYTES) return exact;
  }
  return null;
}

if (existsSync(OUT_FILE)) {
  const size = statSync(OUT_FILE).size;
  if (size >= MIN_BYTES) {
    log(`Already present: ${OUT_FILE} (${(size / 1e6).toFixed(1)} MB). Skipping export.`);
    process.exit(0);
  }
  log(`Existing file too small (${size} bytes); re-exporting.`);
}

const py = findPython();
if (!py) {
  fail(
    "Python 3 not found. Install Python 3 and run:\n" +
      "  pip install ultralytics onnx\n" +
      "  npm run cow:models:seg"
  );
}

mkdirSync(OUT_DIR, { recursive: true });

log("Installing ultralytics + onnx (if needed)...");
run(py, ["-m", "pip", "install", "-q", "ultralytics", "onnx"]);

const workDir = join(FRONTEND_ROOT, ".cow-model-export");
mkdirSync(workDir, { recursive: true });

log("Exporting yolov8n-seg.pt → ONNX (imgsz=640, simplify=True)...");
const exportScript = join(workDir, "_export_seg.py");
writeFileSync(
  exportScript,
  `from ultralytics import YOLO
path = YOLO("yolov8n-seg.pt").export(format="onnx", imgsz=640, simplify=True)
print("EXPORTED:", path)
`,
  "utf8"
);
run(py, [exportScript], { cwd: workDir });

const exported = findExportedOnnx([workDir, FRONTEND_ROOT, process.cwd()]);

let src = exported;
if (!src) {
  const walk = [workDir];
  for (const dir of walk) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name);
      if (name.isFile() && name.name.endsWith(".onnx")) {
        if (statSync(p).size >= MIN_BYTES) {
          src = p;
          break;
        }
      }
    }
    if (src) break;
  }
}

if (!src) {
  fail(
    "Export finished but no .onnx file found. Try manually:\n" +
      "  cd frontend && python -m ultralytics export model=yolov8n-seg.pt format=onnx imgsz=640 simplify=True\n" +
      "  copy yolov8n-seg.onnx to public/models/"
  );
}

copyFileSync(src, OUT_FILE);
const finalSize = statSync(OUT_FILE).size;
log(`Done: ${OUT_FILE} (${(finalSize / 1e6).toFixed(1)} MB)`);
log("Restart dev server, re-analyze a cow photo — expect model yolov8n-seg-onnx and badge AI body outline.");
