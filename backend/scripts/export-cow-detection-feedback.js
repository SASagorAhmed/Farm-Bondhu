/**
 * Export cow_detection_feedback rows to YOLO-style folders.
 * Usage: cd backend && npm run cow:export-feedback
 * Output: backend/exports/cow-feedback-YYYYMMDD/
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function bboxToYoloLine(bbox, imgW, imgH, classId) {
  const cx = (bbox.x + bbox.width / 2) / imgW;
  const cy = (bbox.y + bbox.height / 2) / imgH;
  const w = bbox.width / imgW;
  const h = bbox.height / imgH;
  return `${classId} ${cx.toFixed(6)} ${cy.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });
  const rows = await sql`
    select id, image_url, corrected_head_side, annotation_json, created_at
    from cow_detection_feedback
    order by created_at desc
  `;
  await sql.end();

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const outDir = path.join(__dirname, "..", "exports", `cow-feedback-${stamp}`);
  const imgDir = path.join(outDir, "images");
  const lblDir = path.join(outDir, "labels");
  fs.mkdirSync(imgDir, { recursive: true });
  fs.mkdirSync(lblDir, { recursive: true });

  const readme = `# Cow detection feedback export

Classes (data.yaml):
  0: cow
  1: head

Train example:
  yolo train model=yolov8n.pt data=${outDir}/data.yaml epochs=100 imgsz=640

Replace browser ONNX in frontend/public/models/ after export to ONNX.
`;
  fs.writeFileSync(path.join(outDir, "README.md"), readme);
  fs.writeFileSync(
    path.join(outDir, "data.yaml"),
    `path: ${outDir.replace(/\\/g, "/")}\ntrain: images\nval: images\nnames:\n  0: cow\n  1: head\n`
  );

  let written = 0;
  for (const r of rows) {
    const ann = r.annotation_json || {};
    const bbox = ann.bbox;
    const imgW = Number(ann.imageWidth) || 1280;
    const imgH = Number(ann.imageHeight) || 720;
    if (!bbox) continue;
    const lines = [bboxToYoloLine(bbox, imgW, imgH, 0)];
    if (ann.headBbox) lines.push(bboxToYoloLine(ann.headBbox, imgW, imgH, 1));
    else if (r.corrected_head_side === "left" || r.corrected_head_side === "right") {
      const frac = 0.18;
      const hb =
        r.corrected_head_side === "left"
          ? { x: bbox.x, y: bbox.y, width: bbox.width * frac, height: bbox.height * 0.35 }
          : {
              x: bbox.x + bbox.width * (1 - frac),
              y: bbox.y,
              width: bbox.width * frac,
              height: bbox.height * 0.35,
            };
      lines.push(bboxToYoloLine(hb, imgW, imgH, 1));
    }
    const base = String(r.id).replace(/-/g, "");
    fs.writeFileSync(path.join(lblDir, `${base}.txt`), `${lines.join("\n")}\n`);
    if (r.image_url) {
      fs.writeFileSync(
        path.join(imgDir, `${base}.url.txt`),
        `${r.image_url}\n`,
        "utf8"
      );
    }
    written++;
  }

  console.log(`Exported ${written} label files to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
