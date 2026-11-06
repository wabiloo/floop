/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Floop Checkout - A local clone of the floop repo. Its Boop/Boop/scripts and Scripts folders are loaded. */
  "floopPath"?: string,
  /** Extra Script Folders - Additional folders of scripts, separated by commas. Later folders override earlier ones. */
  "extraFolders"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `run-script` command */
  export type RunScript = ExtensionPreferences & {}
  /** Preferences accessible in the `run-script-by-name` command */
  export type RunScriptByName = ExtensionPreferences & {
  /** Output - What to do with the result. */
  "output": "paste" | "copy"
}
}

declare namespace Arguments {
  /** Arguments passed to the `run-script` command */
  export type RunScript = {}
  /** Arguments passed to the `run-script-by-name` command */
  export type RunScriptByName = {
  /** Script name, e.g. Format JSON */
  "script": string
}
}

