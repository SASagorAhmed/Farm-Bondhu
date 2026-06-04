/**
 * Clears BACKEND_PORT (default 3001) before `npm run dev` (predev).
 * On Windows, Node's --watch parent can respawn the child that owns the port,
 * so clear the owning dev process tree before falling back to kill-port.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import killPort from "kill-port";

const lifecycle = process.env.npm_lifecycle_event;
const isDevPortClear = lifecycle === "predev" || lifecycle === "free-port";

if (process.env.NODE_ENV === "production" && !isDevPortClear) {
  process.exit(0);
}

const port = Number(process.env.BACKEND_PORT) || 3001;

function clearWindowsDevPortTree() {
  if (process.platform !== "win32") return;

  const script = `
$port = ${port}
$currentPid = ${process.pid}
$listeners = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq "Listen" } |
  Select-Object -ExpandProperty OwningProcess -Unique
$ids = New-Object System.Collections.Generic.HashSet[int]
foreach ($listenerPid in $listeners) {
  $pidValue = [int]$listenerPid
  while ($pidValue -and $pidValue -ne 0 -and $pidValue -ne $currentPid) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$pidValue" -ErrorAction SilentlyContinue
    if (-not $proc) { break }
    $cmd = [string]$proc.CommandLine
    $name = [string]$proc.Name
    $isBackendDev =
      $cmd -match "src/server\\.js" -or
      $cmd -match "node --watch" -or
      $cmd -match "npm-cli\\.js.*run dev" -or
      $cmd -match "nodejs/npm.*run dev" -or
      ($name -eq "cmd.exe" -and $cmd -match "node --watch src/server\\.js")
    if (-not $isBackendDev) { break }
    [void]$ids.Add($pidValue)
    $pidValue = [int]$proc.ParentProcessId
  }
}
foreach ($id in $ids) {
  Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
}
if ($ids.Count -gt 0) {
  Write-Output "Stopped Windows dev port process tree: $($ids -join ',')"
}
`;

  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { encoding: "utf8" }
  );
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  if (output) console.log(`[farmbondhu-api] ${output}`);
}

async function main() {
  clearWindowsDevPortTree();
  await new Promise((resolve) => setTimeout(resolve, 500));

  try {
    await killPort(port);
    console.log(`[farmbondhu-api] Port ${port} cleared (or was already free).`);
  } catch (err) {
    const msg = String(err?.message || err);
    if (/no process|not found|Nothing listening/i.test(msg)) {
      console.log(`[farmbondhu-api] Port ${port} was already free.`);
      return;
    }
    console.warn(`[farmbondhu-api] free-port:`, msg);
  }
}

main().catch((err) => {
  console.warn(`[farmbondhu-api] free-port:`, err?.message || err);
});
