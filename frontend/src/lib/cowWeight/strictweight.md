# Strict weight — Detect Live estimate is canonical

> **Rule:** Live weight on every wizard step uses the **same** calculation as Step 1 **Detect** — `computeScanMetrics(mode, lines, analysis)` on the **`lines`** object from analyze, not replaced from vision keypoints when you press Next.

See also: [`cowweight.md`](cowweight.md), [`docs/ai/cow_weight_detection.md`](../../../../docs/ai/cow_weight_detection.md).

---

## 1. How Detect shows Live weight (preview)

After upload, the app runs YOLO + keypoints and builds **`lines`** (chest + length segments):

1. **`analyzeCowImage`** → `proposeLinesFromBBox(bbox, keypoints)` then optional chest fix via `shouldReproposeChest`.
2. **Live estimate** reads **`lines` only**:

```text
chest_pixels  = distance(lines.chest.a, lines.chest.b)   // C1→C2 for weight
length_pixels = distance(lines.length.a, lines.length.b) // L1→L2 for weight

Plan D (default, no 1 m stick):
  Pick camera_distance_cm from {150,160,…,250} (else 180) via pinhole + bbox position
  r1 = r2 = camera_distance_cm ÷ focal_length_px  (dynamic, not fixed 100 cm)
  chest_cm  = chest_pixels × r1   (vertical chest Ch1–Ch2)
  length_cm = length_pixels × r2  (horizontal C1–C2)
  Ground line = bottom of green bbox (y2)

live_kg = (chest_cm)² × (length_cm) ÷ 660
```

Code: [`scanMetrics.ts`](scanMetrics.ts) `computeScanMetrics` + [`distanceScale.ts`](distanceScale.ts) + [`geometry3d.ts`](geometry3d.ts). Frozen `analysis.planD` at Detect keeps kg stable when standoff changes later.

The UI shows **~** because this is an estimate, not a weigh-scale reading.

---

## 2. Step 1 markers vs weight lines

On **Detect**, **Ch1/Ch2** use **`lines.chest`**; **C1/C2** (shoulder → rear) use **`lines.length`** — same as Steps 2–3. Front/Hind come from leg keypoints (hoof columns).

**C1 shoulder** is auto-nudged **20%** toward the head along the length line. **C2 rear** X = tail-side **body end** from the **hind-band mask** (rearmost rump/tail edge); **Y** stays on the length row (same horizontal line as C1). Not the Hind hoof marker (**leg2**).

**Live weight always uses `lines`**. Body length px = shoulder to rump (`lines.length`), not nose-to-tail silhouette.

| What you see | What drives kg on Detect |
|--------------|-------------------------|
| Keypoint markers (Step 1) | Guidance only |
| **`lines.chest` / `lines.length`** | **Weight** |

Dragging markers on Step 1 updates keypoints for display **without** changing weight lines (strict mode). Adjust chest/length for weight on **Step 2–3** (green/red lines).

---

## 3. Why Chest used to show a wrong jump (e.g. 441 → 1355 kg)

**Same formula** on both steps. The bug was **replacing `lines` on Next**:

- **Detect ~441 kg:** shorter `lines.chest` from initial analyze.
- **After Next to Chest ~1355 kg:** `onNext` called `proposeLinesFromBBox(keypoints)` → long C1–C2 (often C2 too low on belly) → huge chest cm.

**Fix (shipped):** Step 1 → 2 no longer overwrites `lines`. Chest step keeps Detect kg until you drag the **green** C1/C2 line.

---

## 4. Use Detect weight for all steps

| Step | Live weight updates when |
|------|---------------------------|
| 1 Detect | Initial `lines`; vision does **not** replace `lines` |
| 2 Chest | You drag **lines.chest** (C1/C2) |
| 3 Length | You drag **lines.length** (L1/L2) |
| 4 Scale | Optional 1 m stick → `lines.reference` changes scale |
| 5–6 | Same `lines` + formula |

Save and result page use the same `lines` → same cm → same ÷660.

---

## 5. Trustworthy kg (farmer)

1. On **Chest**, move **C2** to real lower chest (brisket), not belly/udder.
2. Check **L1** (tail) and **L2** (shoulder) on **Length**.
3. Best accuracy: **1 m stick** at cow height on Step 4.
4. Typical adult dairy side view often falls ~250–750 kg; far outside that → retake or adjust lines.

---

## 6. Detect UI: frozen preview (no floating kg)

On **Step 1**, the Live estimate panel shows a **snapshot** taken once from canonical `lines`:

```text
detectPreview = computeScanMetrics(mode, lines, analysis, standoffM = null)
```

- **Frozen** until you leave Detect or tap Re-analyze — vision assist and camera-distance updates do **not** change this kg.
- Panel stays visible while AI runs (“Calculating weight…”) so the sidebar does not jump.
- Shows **chest cm**, **length cm**, and formula text; badge: “Locked on Detect — drag chest on Step 2 to update”.

**Step 2+** uses live `computeScanMetrics(..., standoff?.meters)` and line drags — same formula, distance nudge allowed when applicable.

Save still uses latest `lines` + standoff at confirm time (unchanged accurate path).

---

## 7. Re-analyze (fresh detection)

**Re-analyze** runs `analyzeCowImage` again, then sets `lines` with the **same** helper as first load: [`canonicalScanLines.ts`](canonicalScanLines.ts) `canonicalLinesFromAnalysis`.

It does **not** call `proposeLinesFromBBox(keypoints)` (that was the old “Chest step” behavior and inflated kg).

After re-analyze: frozen Detect preview is cleared and recomputed from the new canonical `lines`; you return to **Step 1 Detect**.

---

## 8. Analyze → Scan: cloud direction, then YOLO markers (no flicker)

On [`CowWeightAnalyze.tsx`](../../pages/dashboard/cowWeight/CowWeightAnalyze.tsx):

1. **YOLO bbox/mask** — `detectCowGeometry` (models unchanged)
2. **Cloud** — `fetchCloudDirectionAssist` / `applyDirectionOnlyVision` (**head side + head box + standoff only**)
3. **YOLO/mask keypoints** — `detectCowKeypoints(..., { forcedFacing })` once (Front/Hind, C1/C2, L1/L2)

Cloud does **not** call `applyFullVisionAssist` (no chest/leg override). **Live estimate `lines` unchanged**. [`CowWeightOverlay.tsx`](../../components/cowWeight/CowWeightOverlay.tsx) is not modified.

---

## 9. Code map

| File | Role |
|------|------|
| [`canonicalScanLines.ts`](canonicalScanLines.ts) | First load + Re-analyze: same `lines` from `analysis.lines` |
| [`CowWeightScan.tsx`](../../pages/dashboard/cowWeight/CowWeightScan.tsx) | `liveMetrics` = `computeScanMetrics(..., lines)`; no line repropose on Next from step 1 |
| [`scanMetrics.ts`](scanMetrics.ts) | `previewWeightKg`, Plan B scale |
| [`proposeLines.ts`](proposeLines.ts) | Initial line proposal at analyze only |
| [`CowWeightOverlay.tsx`](../../components/cowWeight/CowWeightOverlay.tsx) | Step 1 keypoints vs Step 2+ `lines.chest` |
| [`ScanLiveSummary.tsx`](../../components/cowWeight/ScanLiveSummary.tsx) | Live estimate panel |

---

*Aligned with strict-weight fix: 2026-05-20.*
