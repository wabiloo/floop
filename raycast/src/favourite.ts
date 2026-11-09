import { Clipboard, showHUD, showToast, Toast } from "@raycast/api";
import { getInput } from "./input";
import { runScript, type Script } from "./scripts";

/** Run `script` on the selection/clipboard, then paste or copy the result. */
export async function runAndOutput(script: Script, output: string | undefined) {
  const input = await getInput();
  if (!input) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Select or copy some text first",
    });
    return;
  }
  const r = runScript(script, { fullText: input.text });
  if (r.failed) {
    await showToast({
      style: Toast.Style.Failure,
      title: script.name,
      message: r.messages.at(-1)?.message,
    });
    return;
  }
  if (output === "copy") await Clipboard.copy(r.text);
  else await Clipboard.paste(r.text);
  await showHUD(
    r.messages.find((m) => m.type === "info")?.message ?? `${script.name} ✓`,
  );
}
