#!/usr/bin/env bash
# Granular commits for cow weight + cloud AI work on branch sagor
set -e
cd "$(dirname "$0")/.."

commit() {
  local msg="$1"
  shift
  git add "$@"
  git commit -m "$msg"
}

commit "chore(backend): document OpenRouter vision env for cow assist" backend/.env.example

commit "chore(backend): add npm script to export cow detection feedback" backend/package.json

commit "feat(backend): add OpenRouter chat model allowlist helper" backend/src/services/openrouterChatModels.js

commit "feat(backend): add cow direction assist via OpenRouter vision API" backend/src/routes/v1/cowDirectionAssist.js

commit "feat(backend): add cow detection feedback API and export script" \
  backend/src/routes/v1/cowDetectionFeedback.js \
  backend/scripts/export-cow-detection-feedback.js

commit "feat(backend): extend schema for cow detection feedback storage" backend/src/db/ensureSchema.js

commit "feat(backend): register cow direction and feedback routes on v1 API" backend/src/routes/v1/index.js

commit "feat(backend): wire OpenRouter model list into farm AI chat route" backend/src/routes/v1/aiFarmChat.js

commit "docs(ai): update cow weight detection tracker and training notes" \
  docs/ai/cow_weight_detection.md \
  docs/ai/cow_detection_training.md

commit "chore(cattledataset): tweak formula eval sample script" cattledataset/eval_formula_sample.py

commit "chore(frontend): add exifr dependency for photo EXIF standoff hints" \
  frontend/package.json \
  frontend/package-lock.json

commit "feat(cowWeight): extend analysis types and scan navigation state" \
  frontend/src/lib/cowWeight/types.ts \
  frontend/src/lib/cowWeight/navigation.ts \
  frontend/src/lib/cowWeight/imageExif.ts

commit "feat(cowWeight): add head bbox helpers for vision and mask heuristics" \
  frontend/src/lib/cowWeight/headBbox.ts \
  frontend/src/lib/cowWeight/headBbox.test.ts

commit "feat(cowWeight): add vision vs local direction merge policy" \
  frontend/src/lib/cowWeight/directionMerge.ts

commit "feat(cowWeight): improve body direction and head-tail detection" \
  frontend/src/lib/cowWeight/cowDirection.ts \
  frontend/src/lib/cowWeight/cowDirection.test.ts

commit "feat(cowWeight): strengthen mask leg peaks and projection helpers" \
  frontend/src/lib/cowWeight/cowMask.ts \
  frontend/src/lib/cowWeight/cowMask.legs.test.ts

commit "feat(cowWeight): improve keypoint detection with forced cloud facing" \
  frontend/src/lib/cowWeight/cowKeypoints.ts \
  frontend/src/lib/cowWeight/cowKeypoints.gates.test.ts \
  frontend/src/lib/cowWeight/cowKeypoints.forcedFacing.test.ts

commit "feat(cowWeight): add keypoint merge and direction-only vision path" \
  frontend/src/lib/cowWeight/keypointMerge.ts \
  frontend/src/lib/cowWeight/keypointMerge.test.ts \
  frontend/src/lib/cowWeight/keypointMerge.directionOnly.test.ts

commit "feat(cowWeight): add cloud direction fetch without chest-leg override" \
  frontend/src/lib/cowWeight/runVisionAssist.ts \
  frontend/src/lib/cowWeight/runVisionAssist.test.ts

commit "feat(cowWeight): stage analyze pipeline geometry then cloud then markers" \
  frontend/src/lib/cowWeight/analyzeCow.ts

commit "feat(cowWeight): add canonical scan lines for stable detect weight" \
  frontend/src/lib/cowWeight/canonicalScanLines.ts \
  frontend/src/lib/cowWeight/canonicalScanLines.test.ts

commit "feat(cowWeight): add camera standoff research and estimate blending" \
  frontend/src/lib/cowWeight/cowWeightResearch.ts \
  frontend/src/lib/cowWeight/cowWeightResearch.test.ts \
  frontend/src/lib/cowWeight/standoffEstimate.ts \
  frontend/src/lib/cowWeight/standoffEstimate.test.ts

commit "feat(cowWeight): extend scan metrics and pixel scale for plan B" \
  frontend/src/lib/cowWeight/pixelsToCm.ts \
  frontend/src/lib/cowWeight/scanMetrics.ts \
  frontend/src/lib/cowWeight/scanMetrics.standoff.test.ts

commit "feat(cowWeight): extend API client for direction assist and feedback" frontend/src/lib/cowWeight/api.ts

commit "test(cowWeight): add strict weight detect snapshot tests" \
  frontend/src/lib/cowWeight/strictweight.test.ts

commit "docs(cowWeight): document strict weight rules and OpenRouter cloud flow" \
  frontend/src/lib/cowWeight/strictweight.md \
  frontend/src/lib/cowWeight/cloudai.md \
  frontend/src/lib/cowWeight/cowweight.md

commit "feat(cowWeight): add live estimate summary panel for scan steps" \
  frontend/src/components/cowWeight/ScanLiveSummary.tsx

commit "feat(cowWeight): improve scan overlay markers and step-one keypoint drag" \
  frontend/src/components/cowWeight/CowWeightOverlay.tsx

commit "feat(cowWeight): improve analyze upload and hub entry flow" \
  frontend/src/pages/dashboard/cowWeight/CowWeightAnalyze.tsx \
  frontend/src/pages/dashboard/cowWeight/CowWeightUpload.tsx \
  frontend/src/pages/dashboard/cowWeight/CowWeightHub.tsx

commit "feat(cowWeight): improve multi-step scan with frozen detect preview" \
  frontend/src/pages/dashboard/cowWeight/CowWeightScan.tsx

commit "feat(cowWeight): improve confirm and result pages with standoff data" \
  frontend/src/pages/dashboard/cowWeight/CowWeightConfirm.tsx \
  frontend/src/pages/dashboard/cowWeight/CowWeightResult.tsx

commit "feat(admin): add cow detection feedback export page" \
  frontend/src/pages/admin/AdminCowDetectionExport.tsx \
  frontend/src/App.tsx

commit "i18n: add cow weight scan cloud and live estimate strings" frontend/src/i18n/translations.ts

commit "feat(chat): improve farm chatbot model picker and OpenRouter integration" frontend/src/components/FarmChatbot.tsx

echo "Done: $(git rev-list --count HEAD ^origin/sagor 2>/dev/null || git rev-list --count HEAD) new commits on $(git branch --show-current)"
