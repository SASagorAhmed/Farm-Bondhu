#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

commit() {
  local msg="$1"
  shift
  if [ "$#" -eq 0 ]; then
    echo "skip empty: $msg"
    return 0
  fi
  git add "$@"
  if git diff --cached --quiet; then
    echo "skip (no staged changes): $msg"
    return 0
  fi
  git commit -m "$(cat <<EOF
$msg
EOF
)"
  echo "OK: $msg"
}

commit "feat(db): add cow_name column to cow_weight_estimations schema" \
  backend/src/db/ensureSchema.js

commit "feat(api): support cow_name and default label on cow estimations" \
  backend/src/routes/v1/cowEstimation.js

commit "feat(cowWeight): extend estimation types and navigation state" \
  frontend/src/lib/cowWeight/types.ts \
  frontend/src/lib/cowWeight/navigation.ts

commit "feat(cowWeight): add shared farm-green theme tokens for UI" \
  frontend/src/lib/cowWeight/cowWeightTheme.ts \
  frontend/src/lib/cowWeight/cowWeightAuditTheme.ts

commit "feat(cowWeight): add 2D geometry helpers for scan overlays" \
  frontend/src/lib/cowWeight/geometry2d.ts

commit "feat(cowWeight): add camera distance and standoff geometry module" \
  frontend/src/lib/cowWeight/geometry3d.ts \
  frontend/src/lib/cowWeight/geometry3d.test.ts

commit "feat(cowWeight): add distance scale calibration helpers" \
  frontend/src/lib/cowWeight/distanceScale.ts \
  frontend/src/lib/cowWeight/distanceScale.test.ts

commit "feat(cowWeight): add calculation breakdown for scan transparency" \
  frontend/src/lib/cowWeight/calculationBreakdown.ts \
  frontend/src/lib/cowWeight/calculationBreakdown.test.ts

commit "feat(cowWeight): add body segment measurement utilities" \
  frontend/src/lib/cowWeight/measureSegments.ts

commit "feat(cowWeight): add manual dimension estimate and validation" \
  frontend/src/lib/cowWeight/manualEstimate.ts \
  frontend/src/lib/cowWeight/manualEstimate.test.ts

commit "feat(cowWeight): add ground distance display helpers" \
  frontend/src/lib/cowWeight/groundDistanceDisplay.ts

commit "feat(cowWeight): add workspace-relative route path helper" \
  frontend/src/lib/cowWeight/cowWeightPaths.ts

commit "feat(cowWeight): add in-browser camera capture utilities" \
  frontend/src/lib/cowWeight/captureFromCamera.ts \
  frontend/src/lib/cowWeight/captureFromCamera.device.test.ts

commit "feat(cowWeight): improve keypoint detection and facing stability" \
  frontend/src/lib/cowWeight/cowKeypoints.ts \
  frontend/src/lib/cowWeight/cowKeypoints.chestSync.test.ts \
  frontend/src/lib/cowWeight/cowKeypoints.lengthShoulderRear.test.ts \
  frontend/src/lib/cowWeight/cowKeypoints.stableFacing.test.ts

commit "feat(cowWeight): refine cow mask tracing for body outline" \
  frontend/src/lib/cowWeight/cowMask.ts

commit "feat(cowWeight): tighten proposeLines and canonical scan lines" \
  frontend/src/lib/cowWeight/proposeLines.ts \
  frontend/src/lib/cowWeight/proposeLines.clampFacing.test.ts \
  frontend/src/lib/cowWeight/canonicalScanLines.ts

commit "feat(cowWeight): improve pixel scale and reference line conversion" \
  frontend/src/lib/cowWeight/pixelsToCm.ts \
  frontend/src/lib/cowWeight/referenceScale.ts

commit "feat(cowWeight): expand scan metrics and strict weight tests" \
  frontend/src/lib/cowWeight/scanMetrics.ts \
  frontend/src/lib/cowWeight/scanMetrics.standoff.test.ts \
  frontend/src/lib/cowWeight/strictweight.test.ts \
  frontend/src/lib/cowWeight/strictweight.md \
  frontend/src/lib/cowWeight/cowWeightResearch.ts

commit "feat(cowWeight): wire analyze pipeline and estimation API client" \
  frontend/src/lib/cowWeight/analyzeCow.ts \
  frontend/src/lib/cowWeight/api.ts

commit "feat(cowWeight): add page shell, disclaimer, and callout styles" \
  frontend/src/components/cowWeight/CowWeightPageShell.tsx \
  frontend/src/components/cowWeight/CowWeightDisclaimer.tsx \
  frontend/src/components/cowWeight/cowWeightCalloutStyles.ts \
  frontend/src/components/cowWeight/CowWeightCallout.tsx

commit "feat(cowWeight): add distance bar and head-side scan panels" \
  frontend/src/components/cowWeight/CameraDistanceBar.tsx \
  frontend/src/components/cowWeight/CowWeightHeadSidePanel.tsx \
  frontend/src/components/cowWeight/CowWeightRetakeAlert.tsx \
  frontend/src/components/cowWeight/CowWeightGreenbondhuAlert.tsx

commit "feat(cowWeight): add photo capture actions and camera dialog" \
  frontend/src/components/cowWeight/CowWeightPhotoActions.tsx \
  frontend/src/components/cowWeight/CowWeightCameraDialog.tsx

commit "feat(cowWeight): refresh scan overlay, stepper, and live summary UI" \
  frontend/src/components/cowWeight/ScanCalculationBreakdown.tsx \
  frontend/src/components/cowWeight/ScanDetailPanel.tsx \
  frontend/src/components/cowWeight/ScanLiveSummary.tsx \
  frontend/src/components/cowWeight/ScanStepper.tsx \
  frontend/src/components/cowWeight/ScaleFormulaBlock.tsx \
  frontend/src/components/cowWeight/CowWeightOverlay.tsx

commit "feat(cowWeight): add hub and manual demo marketing images" \
  frontend/src/components/cowWeight/CowWeightPlanBDemoImage.tsx \
  frontend/src/components/cowWeight/CowWeightManualDemoImage.tsx \
  frontend/src/assets/cow-weight-website.png \
  frontend/src/assets/cow-weight-manual-website.png

commit "feat(cowWeight): add optional cow name field on save" \
  frontend/src/components/cowWeight/CowWeightCowNameField.tsx

commit "feat(cowWeight): redesign hub with AI and manual entry cards" \
  frontend/src/pages/dashboard/cowWeight/CowWeightHub.tsx

commit "feat(cowWeight): improve upload flow with camera and gallery actions" \
  frontend/src/pages/dashboard/cowWeight/CowWeightUpload.tsx

commit "feat(cowWeight): streamline analyze step with retake support" \
  frontend/src/pages/dashboard/cowWeight/CowWeightAnalyze.tsx

commit "feat(cowWeight): expand guided scan wizard and save flow" \
  frontend/src/pages/dashboard/cowWeight/CowWeightScan.tsx

commit "feat(cowWeight): enhance confirm step with cow name on save" \
  frontend/src/pages/dashboard/cowWeight/CowWeightConfirm.tsx

commit "feat(cowWeight): show result photo, cow name, and distance details" \
  frontend/src/pages/dashboard/cowWeight/CowWeightResult.tsx

commit "feat(cowWeight): add manual measurement entry page" \
  frontend/src/pages/dashboard/cowWeight/CowWeightManual.tsx

commit "feat(cowWeight): register manual route in estimator shell" \
  frontend/src/pages/dashboard/cowWeight/CowWeightEstimator.tsx

commit "i18n: add cow weight scan, manual, beta sidebar, and alert copy" \
  frontend/src/i18n/translations.ts

commit "feat(routes): mount cow-weight under marketplace, vetbondhu, and vet" \
  frontend/src/App.tsx

commit "feat(sidebar): expose Cow Weight AI (Beta) across workspace panels" \
  frontend/src/components/layout/MarketplaceSidebar.tsx \
  frontend/src/components/layout/VetBondhuSidebar.tsx \
  frontend/src/components/layout/VetSidebar.tsx \
  frontend/src/index.css

commit "docs(cowWeight): update cloud AI, module notes, and research paper" \
  frontend/src/lib/cowWeight/cloudai.md \
  frontend/src/lib/cowWeight/cowweight.md \
  research_paper.md

echo ""
echo "Done. Commit count on branch:"
git rev-list --count HEAD ^origin/sagor 2>/dev/null || git rev-list --count HEAD
