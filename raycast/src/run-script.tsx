import {
  Action,
  ActionPanel,
  Clipboard,
  Detail,
  Icon,
  List,
  closeMainWindow,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { getInput, type Input } from "./input";
import { loadAll, runScript, type Script } from "./scripts";

function ResultView({ script, input }: { script: Script; input: Input }) {
  const result = useMemo(
    () => runScript(script, { fullText: input.text }),
    [script, input],
  );
  const notes = result.messages
    .map((m) => `${m.type === "error" ? "⚠️" : "ℹ️"} ${m.message}`)
    .join("\n\n");
  const fence = "`".repeat(
    Math.max(3, ...(result.text.match(/`+/g) ?? []).map((s) => s.length + 1)),
  );
  return (
    <Detail
      navigationTitle={script.name}
      markdown={`${notes ? notes + "\n\n" : ""}${fence}\n${result.text}\n${fence}`}
      actions={
        <ActionPanel>
          {!result.failed && (
            <>
              <Action
                title={
                  input.from === "selection" ? "Paste Over Selection" : "Paste"
                }
                icon={Icon.Clipboard}
                onAction={async () => {
                  await Clipboard.paste(result.text);
                  await closeMainWindow();
                }}
              />
              <Action.CopyToClipboard
                title="Copy Result"
                content={result.text}
              />
            </>
          )}
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  const [input, setInput] = useState<Input | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const scripts = useMemo(() => {
    try {
      return loadAll();
    } catch (e) {
      setError(String(e));
      return [];
    }
  }, []);

  useEffect(() => {
    getInput().then((i) => {
      setInput(i);
      setLoading(false);
    });
  }, []);

  if (!loading && scripts.length === 0) {
    return (
      <Detail
        markdown={`# No scripts found\n\nSet **Floop Checkout** (a clone of the floop repo) in the extension preferences, or add **Extra Script Folders**.${error ? `\n\n${error}` : ""}`}
        actions={
          <ActionPanel>
            <Action.OpenInBrowser
              title="Open Floop on GitHub"
              url="https://github.com/wabiloo/floop"
            />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <List
      isLoading={loading}
      searchBarPlaceholder={
        input
          ? `Run a script on the ${input.from} (${input.text.length} chars)…`
          : "No selection or clipboard text"
      }
    >
      {input === undefined && !loading ? (
        <List.EmptyView
          title="Nothing to transform"
          description="Select some text or copy it first."
          icon={Icon.Text}
        />
      ) : (
        scripts.map((s) => (
          <List.Item
            key={s.id}
            title={s.name}
            subtitle={s.description}
            keywords={[...s.tags.split(","), s.file, s.author]}
            actions={
              input && (
                <ActionPanel>
                  <Action.Push
                    title="Run and Show Result"
                    icon={Icon.Play}
                    target={<ResultView script={s} input={input} />}
                  />
                  <Action
                    title={
                      input.from === "selection"
                        ? "Run and Paste Over Selection"
                        : "Run and Paste"
                    }
                    icon={Icon.Clipboard}
                    shortcut={{ modifiers: ["cmd"], key: "return" }}
                    onAction={async () => {
                      const r = runScript(s, { fullText: input.text });
                      if (r.failed)
                        return showToast({
                          style: Toast.Style.Failure,
                          title: s.name,
                          message: r.messages.at(-1)?.message,
                        });
                      await Clipboard.paste(r.text);
                      await showHUD(
                        r.messages.find((m) => m.type === "info")?.message ??
                          `${s.name} ✓`,
                      );
                    }}
                  />
                  <Action
                    title="Run and Copy"
                    icon={Icon.CopyClipboard}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "return" }}
                    onAction={async () => {
                      const r = runScript(s, { fullText: input.text });
                      if (r.failed)
                        return showToast({
                          style: Toast.Style.Failure,
                          title: s.name,
                          message: r.messages.at(-1)?.message,
                        });
                      await Clipboard.copy(r.text);
                      await showHUD("Copied");
                    }}
                  />
                </ActionPanel>
              )
            }
          />
        ))
      )}
    </List>
  );
}
