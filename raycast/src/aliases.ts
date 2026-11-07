import { LocalStorage } from "@raycast/api";

/** script file name (e.g. "Base64Encode.js") -> aliases */
export type Aliases = Record<string, string[]>;

const KEY = "aliases";

export async function loadAliases(): Promise<Aliases> {
  try {
    return JSON.parse((await LocalStorage.getItem<string>(KEY)) ?? "{}");
  } catch {
    return {};
  }
}

export async function saveAliases(
  file: string,
  aliases: string[],
): Promise<Aliases> {
  const all = await loadAliases();
  const clean = [...new Set(aliases.map((a) => a.trim()).filter(Boolean))];
  if (clean.length) all[file] = clean;
  else delete all[file];
  await LocalStorage.setItem(KEY, JSON.stringify(all));
  return all;
}

/** The script file whose alias equals `query` (case-insensitive), if any. */
export function fileForAlias(all: Aliases, query: string): string | undefined {
  const q = query.trim().toLowerCase();
  return Object.keys(all).find((f) =>
    all[f].some((a) => a.toLowerCase() === q),
  );
}
