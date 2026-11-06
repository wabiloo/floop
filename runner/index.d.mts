export const TIMEOUT_MS: number
export interface ScriptMeta { name: string; description: string; tags: string; icon: string; bias: number; author: string }
export interface Script extends ScriptMeta { id: string; source: string; file: string; code: string; files: Record<string, string>; sharedLibs: Record<string, string> }
export interface Message { type: 'info' | 'error'; message: string }
export interface RunInput { fullText?: string; selection?: string | null; insertIndex?: number | null; timeout?: number }
export interface RunResult { text: string; isSelection?: boolean; messages: Message[]; failed?: true }
export function parseMeta(code: string): Record<string, unknown> | null
export function loadScripts(dirs: string | string[]): Script[]
export function findScript(scripts: Script[], query: string): Script | undefined
export function search(scripts: Script[], query: string): Script[]
export function runScript(script: Script, input?: RunInput): RunResult
