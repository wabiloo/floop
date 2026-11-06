import { getPreferenceValues, environment } from "@raycast/api";
import { join } from "node:path";
import { existsSync } from "node:fs";
// The runner is plain ESM JS with a hand-written .d.ts; ray build bundles it.
import {
  loadScripts,
  findScript,
  runScript,
  type Script,
} from "../../runner/index.mjs";

export type { Script };
export { findScript, runScript };

interface Prefs {
  floopPath?: string;
  extraFolders?: string;
}

/** Folders to load scripts from, per the extension preferences. */
export function scriptFolders(): string[] {
  const { floopPath, extraFolders } = getPreferenceValues<Prefs>();
  const dirs: string[] = [];
  if (floopPath)
    dirs.push(join(floopPath, "Boop/Boop/scripts"), join(floopPath, "Scripts"));
  else if (environment.isDevelopment) {
    // `npm run dev` from a checkout: use the scripts next to this extension.
    for (const rel of ["../Boop/Boop/scripts", "../Scripts"]) {
      const p = join(environment.assetsPath, "..", rel);
      if (existsSync(p)) dirs.push(p);
    }
  }
  for (const d of (extraFolders ?? "").split(",")) {
    const t = d.trim().replace(/^~(?=$|\/)/, process.env.HOME ?? "~");
    if (t) dirs.push(t);
  }
  return dirs;
}

export function loadAll(): Script[] {
  return loadScripts(scriptFolders());
}
