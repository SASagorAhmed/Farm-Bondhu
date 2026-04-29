import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { comparePerfSnapshots, printPerfTopN, savePerfSnapshot } from "@/lib/perfMetrics";

if (typeof window !== "undefined") {
  (
    window as unknown as {
      farmbondhuPerfTop10?: () => unknown;
      farmbondhuPerfSave?: (name: string) => unknown;
      farmbondhuPerfCompare?: (from: string, to: string) => unknown;
    }
  ).farmbondhuPerfTop10 = () => printPerfTopN(10);
  (window as unknown as { farmbondhuPerfSave?: (name: string) => unknown }).farmbondhuPerfSave = (name: string) =>
    savePerfSnapshot(name, 10);
  (
    window as unknown as { farmbondhuPerfCompare?: (from: string, to: string) => unknown }
  ).farmbondhuPerfCompare = (from: string, to: string) => comparePerfSnapshots(from, to);
}

createRoot(document.getElementById("root")!).render(<App />);
