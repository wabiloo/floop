import { getPreferenceValues, showToast, Toast } from "@raycast/api";
import { runAndOutput } from "./favourite";
import { loadAll } from "./scripts";

/** Entry point shared by the generated `script-*` commands (see tools/generate-commands.mjs). */
export async function runFavourite(file: string) {
  const { output } = getPreferenceValues<{ output?: string }>();
  const script = loadAll().find((s) => s.file === file);
  if (!script) {
    return showToast({
      style: Toast.Style.Failure,
      title: `Script ${file} not found`,
      message: "Check the Floop Checkout preference.",
    });
  }
  return runAndOutput(script, output);
}
