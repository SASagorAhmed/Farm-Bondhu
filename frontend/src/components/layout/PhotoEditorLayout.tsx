import { Outlet } from "react-router-dom";

/** Full-screen editor shell without vendor sidebar. */
export default function PhotoEditorLayout() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
