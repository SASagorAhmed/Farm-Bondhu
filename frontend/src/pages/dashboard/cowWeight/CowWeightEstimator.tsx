import { Routes, Route } from "react-router-dom";
import CowWeightHub from "./CowWeightHub";
import CowWeightUpload from "./CowWeightUpload";
import CowWeightAnalyze from "./CowWeightAnalyze";
import CowWeightConfirm from "./CowWeightConfirm";
import CowWeightScan from "./CowWeightScan";
import CowWeightResult from "./CowWeightResult";

export default function CowWeightEstimator() {
  return (
    <Routes>
      <Route index element={<CowWeightHub />} />
      <Route path="upload" element={<CowWeightUpload />} />
      <Route path="analyze" element={<CowWeightAnalyze />} />
      <Route path="scan" element={<CowWeightScan />} />
      <Route path="confirm" element={<CowWeightConfirm />} />
      <Route path="result" element={<CowWeightResult />} />
    </Routes>
  );
}
