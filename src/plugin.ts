import { green } from 'kleur/colors'
import { startTask } from 'misty/task'
import { Plugin } from 'saus/vite'
import { PostgresRuntimeConfig } from './configFlags'
import { DevSettings, loadDevSettings } from './devSettings'
import { useDevServer } from './server'
import { InlineScript, sql } from './sql'
import { removeDataDir } from './wipe'

export { sql }

export interface Options {
  /**
   * The database name to run seed scripts on.
   * @default "main"
   */
  name?: string
  /**
   * Where to store the development database. \
   * Relative to the project root.
   *
   * @default process.env.PGDATA || "node_modules/.vite-postgres"
   */
  dataDir?: string
  /**
   * Disable logs from the Postgres server.
   */
  quiet?: boolean
  /**
   * Paths to scripts that are used to seed the database. \
   * Relative to the project root.
   *
   * Can be JavaScript, TypeScript, or SQL.
   */
  seedScripts?: (string | InlineScript)[]
  /**
   * Set values within the `postgresql.conf` file.
   */
  serverConfig?: PostgresRuntimeConfig
  /**
   * If true, the database will be wiped on every server restart.
   * The seed scripts also run.
   */
  wipeOnRestart?: boolean
}

export function vitePostgres(options: Options = {}) {
  const devSettings = {} as DevSettings
  const devPlugin: Plugin = {
    name: 'postgres:dev',
    apply: 'serve',
    api: devSettings,
    async configResolved(config) {
      let { name, dataDir, seedScripts, serverConfig, stdio } = Object.assign(
        devSettings,
        loadDevSettings(options, config.root)
      )

      devPlugin.configureServer = async server => {
        const task = startTask('Starting your Postgres server...')

        if (options.wipeOnRestart) {
          await removeDataDir(dataDir)
        }

        serverConfig.log_min_messages = 'fatal'
        const db = await useDevServer(
          name,
          dataDir,
          serverConfig,
          seedScripts,
          stdio
        )
        task.finish(
          'Postgres server is ready at ' + green('http://localhost:' + db.port)
        )

        process.env.PGPORT = String(db.port)
        process.env.PGDATABASE = name

        server.httpServer?.on('close', () => {
          db.close()
        })
      }
    },
  }

  // const buildPlugin: Plugin = {
  //   name: 'postgres:build',
  //   apply: 'build',
  //   config: () => ({
  //     define: {},
  //   }),
  // }

  return [devPlugin]
}
