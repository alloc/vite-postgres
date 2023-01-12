import path from 'path'
import type { Options } from './plugin'
import { InlineScript, isInlineScript } from './sql'

export type DevSettings = ReturnType<typeof loadDevSettings>

export function loadDevSettings(options: Options, root: string) {
  return {
    ...options,
    root,
    name: options.name ?? 'main',
    dataDir: path.resolve(
      root,
      options.dataDir || process.env.PGDATA || 'node_modules/.vite-postgres'
    ),
    seedScripts: options.seedScripts?.map((script): string | InlineScript =>
      isInlineScript(script) ? script : path.resolve(root, script)
    ),
    serverConfig: options.serverConfig ?? {},
    stdio: ['ignore', options.quiet ? 'ignore' : 'inherit', 'inherit'] as any,
  }
}
