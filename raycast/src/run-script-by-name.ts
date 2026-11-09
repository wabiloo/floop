import {
  LaunchProps,
  getPreferenceValues,
  showToast,
  Toast,
} from "@raycast/api";
import { fileForAlias, loadAliases } from "./aliases";
import { runAndOutput } from "./favourite";
import { findScript, loadAll, runScript } from "./scripts";

export default async function Command(
  props: LaunchProps<{ arguments: Arguments.RunScriptByName }>,
) {
  const { output } = getPreferenceValues<Preferences.RunScriptByName>();
  const scripts = loadAll();
  const aliasFile = fileForAlias(await loadAliases(), props.arguments.script);
  const script =
    (aliasFile && scripts.find((s) => s.file === aliasFile)) ||
    findScript(scripts, props.arguments.script);
  if (!script) {
    return showToast({
      style: Toast.Style.Failure,
      title: `No script matching "${props.arguments.script}"`,
    });
  }
  return runAndOutput(script, output);
}
