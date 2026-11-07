import {
  Clipboard,
  LaunchProps,
  getPreferenceValues,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import { fileForAlias, loadAliases } from "./aliases";
import { getInput } from "./input";
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
  const input = await getInput();
  if (!input)
    return showToast({
      style: Toast.Style.Failure,
      title: "Select or copy some text first",
    });

  const r = runScript(script, { fullText: input.text });
  if (r.failed) {
    return showToast({
      style: Toast.Style.Failure,
      title: script.name,
      message: r.messages.at(-1)?.message,
    });
  }
  if (output === "copy") await Clipboard.copy(r.text);
  else await Clipboard.paste(r.text);
  await showHUD(
    r.messages.find((m) => m.type === "info")?.message ?? `${script.name} ✓`,
  );
}
