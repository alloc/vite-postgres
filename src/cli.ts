import { success } from 'misty'
import os from 'os'
import path from 'path'
import sade from 'sade'
import { DevSettings } from './devSettings'
import { createDatabase, createSuperUser, initDataDir } from './init'
import { runSeedScript } from './seed'
import { useDevServer, useServer } from './server'
import { removeDataDir } from './wipe'

const cli = sade('vite-postgres')

cli
  .command('init')
  .describe("Initialize the database, but don't seed it")
  .action(async () => {
    const { name, dataDir, serverConfig } = await getDevSettings()
    if (await initDataDir(dataDir)) {
      serverConfig.log_min_messages = 'fatal'
      await useServer(dataDir, serverConfig, 'inherit', async port => {
        await createSuperUser(os.userInfo().username, port, 'ignore')
        await createDatabase(name, port, 'ignore')
      })
      success('Initialized database')
    } else {
      success('Database already initialized')
    }
  })

cli
  .command('seed [...scripts]', 'Run a given seed script or the configured one')
  .option('--wipe', 'Wipe the database before running the seed script')
  .action(async (scriptArgs: string[] = [], options = {}) => {
    let { name, dataDir, seedScripts, serverConfig } = await getDevSettings()
    if (scriptArgs.length) {
      seedScripts = scriptArgs.map(script => path.resolve(script))
    } else if (!seedScripts) {
      throw Error('No seed script configured')
    }
    if (options.wipe) {
      await removeDataDir(dataDir)
    }
    serverConfig.log_min_messages = 'fatal'
    const db = await useDevServer(name, dataDir, serverConfig)
    for (const seedScript of seedScripts) {
      await runSeedScript(seedScript, db.port, name, 'inherit')
    }
    success('Postgres is now seeded!')
    db.close()
  })

cli.command('wipe', 'Wipe the database').action(async () => {
  const settings = await getDevSettings()
  await removeDataDir(settings.dataDir)
})

async function getDevSettings() {
  const { resolveConfig } = await import('vite')
  const config = await resolveConfig({}, 'serve')
  return config.plugins.find(p => p.name === 'postgres:dev')?.api as DevSettings
}

cli.parse(process.argv)
