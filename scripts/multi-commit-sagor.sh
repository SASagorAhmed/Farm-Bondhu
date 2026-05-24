#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

commit() {
  local msg="$1"
  shift
  git add "$@"
  git commit -m "$msg"
}

commit "chore: ignore cattle dataset blobs and debug logs in root gitignore" .gitignore

commit "chore(frontend): ignore local ONNX cow seg model artifacts" frontend/.gitignore

commit "docs(cattledataset): add README and local gitignore for YOLO data" cattledataset/README.md cattledataset/.gitignore

commit "feat(cattledataset): add dataset download scripts" cattledataset/download.ps1 cattledataset/download_dataset.py

commit "feat(cattledataset): add dataset inspect and cleanup utilities" cattledataset/inspect_download.py cattledataset/cleanup_old_dataset.py

commit "feat(cattledataset): add formula eval tooling and segmentation prep notes" cattledataset/eval_formula_sample.py cattledataset/requirements.txt cattledataset/SEG_PREP.md

commit "docs(ai): document cow weight detection and direction logic" docs/ai/cow_weight_detection.md

commit "docs: update project overview for cow weight and MediBondhu work" aboutproject.md

commit "feat(backend): add cow live weight estimation formula service" backend/src/services/cowEstimationFormula.js

commit "feat(backend): add cow estimation REST API routes" backend/src/routes/v1/cowEstimation.js

commit "feat(backend): ensure schema for cow weight estimation records" backend/src/db/ensureSchema.js

commit "feat(backend): register cow estimation routes on v1 API" backend/src/routes/v1/index.js

commit "feat(cowWeight): add core types and scan flow navigation" frontend/src/lib/cowWeight/types.ts frontend/src/lib/cowWeight/navigation.ts

commit "feat(cowWeight): add image helpers and pixel-to-cm conversion" frontend/src/lib/cowWeight/imageUtils.ts frontend/src/lib/cowWeight/pixelsToCm.ts

commit "feat(cowWeight): add body mask geometry helpers for head and tail" frontend/src/lib/cowWeight/cowMask.ts

commit "feat(cowWeight): add YOLO bbox detection for cow" frontend/src/lib/cowWeight/yoloDetect.ts

commit "feat(cowWeight): add YOLO segmentation mask inference" frontend/src/lib/cowWeight/yoloSegDetect.ts

commit "feat(cowWeight): add reference scale detection for plan C" frontend/src/lib/cowWeight/referenceScale.ts

commit "feat(cowWeight): add leg column detection from photo and mask" frontend/src/lib/cowWeight/legDetect.ts

commit "feat(cowWeight): propose chest and length lines from keypoints" frontend/src/lib/cowWeight/proposeLines.ts

commit "feat(cowWeight): compute scan metrics and weight estimates" frontend/src/lib/cowWeight/scanMetrics.ts

commit "feat(cowWeight): add head-tail direction detection with confidence gating" frontend/src/lib/cowWeight/cowDirection.ts frontend/src/lib/cowWeight/cowDirection.test.ts

commit "feat(cowWeight): detect keypoints and resolve head side without false defaults" frontend/src/lib/cowWeight/cowKeypoints.ts

commit "feat(cowWeight): orchestrate cow image analysis pipeline" frontend/src/lib/cowWeight/analyzeCow.ts

commit "feat(cowWeight): add API client to persist cow estimations" frontend/src/lib/cowWeight/api.ts

commit "docs(cowWeight): add developer notes for weight scan module" frontend/src/lib/cowWeight/cowweight.md

commit "feat(cowWeight): add scan stepper and detail panel components" frontend/src/components/cowWeight/ScanStepper.tsx frontend/src/components/cowWeight/ScanDetailPanel.tsx

commit "feat(cowWeight): add interactive scan overlay with markers" frontend/src/components/cowWeight/CowWeightOverlay.tsx

commit "feat(cowWeight): add scale formula display block" frontend/src/components/cowWeight/ScaleFormulaBlock.tsx

commit "feat(cowWeight): add hub and photo upload pages" frontend/src/pages/dashboard/cowWeight/CowWeightHub.tsx frontend/src/pages/dashboard/cowWeight/CowWeightUpload.tsx

commit "feat(cowWeight): add multi-step scan page with orientation UI" frontend/src/pages/dashboard/cowWeight/CowWeightScan.tsx

commit "feat(cowWeight): add analyze and confirm steps" frontend/src/pages/dashboard/cowWeight/CowWeightAnalyze.tsx frontend/src/pages/dashboard/cowWeight/CowWeightConfirm.tsx

commit "feat(cowWeight): add result and estimator pages" frontend/src/pages/dashboard/cowWeight/CowWeightResult.tsx frontend/src/pages/dashboard/cowWeight/CowWeightEstimator.tsx

commit "chore(cowWeight): add ONNX export script and models README" frontend/public/models/README.md frontend/scripts/export-cow-seg-onnx.mjs

commit "chore(frontend): add onnxruntime-web for client-side cow segmentation" frontend/package.json frontend/package-lock.json

commit "feat(cowWeight): wire cow weight routes in application router" frontend/src/App.tsx

commit "feat(cowWeight): add cow weight entry to farm sidebar" frontend/src/components/layout/FarmSidebar.tsx

commit "i18n: add cow weight scan and direction strings" frontend/src/i18n/translations.ts

commit "feat(medibondhu): add doctor consultations page" frontend/src/pages/doctor/MediDoctorConsultations.tsx

commit "feat(medibondhu): add doctor earnings page" frontend/src/pages/doctor/MediDoctorEarnings.tsx

commit "feat(medibondhu): add doctor patients page" frontend/src/pages/doctor/MediDoctorPatients.tsx

commit "feat(medibondhu): improve doctor dashboard" frontend/src/pages/doctor/MediDoctorDashboard.tsx

commit "feat(medibondhu): improve doctor profile setup flow" frontend/src/pages/doctor/MediDoctorProfileSetup.tsx

commit "feat(medibondhu): improve doctor schedule management" frontend/src/pages/doctor/MediDoctorSchedule.tsx

commit "feat(medibondhu): improve book consultation flow" frontend/src/pages/medibondhu/BookConsultation.tsx

commit "feat(medibondhu): improve patient waiting room" frontend/src/pages/medibondhu/MediWaitingRoom.tsx

commit "feat(medibondhu): extend backend MediBondhu API routes" backend/src/routes/v1/medibondhu.js

commit "feat(medibondhu): update admin human MediBondhu tools" frontend/src/pages/admin/AdminMediBondhuHuman.tsx

commit "feat(medibondhu): update MediBondhu sidebar navigation" frontend/src/components/layout/MediBondhuSidebar.tsx

commit "feat(medibondhu): update top bar for MediBondhu context" frontend/src/components/layout/TopBar.tsx

commit "fix(auth): tighten protected route handling" frontend/src/components/ProtectedRoute.tsx

commit "chore(frontend): tune query client and API client" frontend/src/lib/queryClient.ts frontend/src/api/client.ts

commit "fix(auth): improve signup page" frontend/src/pages/Signup.tsx

commit "feat(notifications): improve notifications page" frontend/src/pages/dashboard/Notifications.tsx

commit "feat(profile): improve access center and profile pages" frontend/src/pages/profile/AccessCenter.tsx frontend/src/pages/profile/ProfilePage.tsx

echo "Done: $(git rev-list --count HEAD) commits on $(git branch --show-current)"
