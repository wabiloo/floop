import { Clipboard, getSelectedText } from "@raycast/api";

export interface Input {
  text: string;
  /** Where the text came from: the frontmost app's selection, or the clipboard. */
  from: "selection" | "clipboard";
}

/** Selected text if there is any, otherwise the clipboard. */
export async function getInput(): Promise<Input | undefined> {
  try {
    const text = await getSelectedText();
    if (text) return { text, from: "selection" };
  } catch {
    // no selection or no accessibility access: fall back to the clipboard
  }
  const text = await Clipboard.readText();
  return text ? { text, from: "clipboard" } : undefined;
}
