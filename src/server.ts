import exec from '@cush/exec'
import { IOType } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getPortPromise } from 'portfinder'
import { getConfigFlags, PostgresRuntimeConfig } from './configFlags'
import { createDatabase, createSuperUser, initDataDir } from './init'
import { psql, runSeedScript } from './seed'

export type Stdio =
  | ((stdout: string, stderr: string) => void)
  | IOType[]
  | IOType

export type Server = {
  port: number
  close: () => void
}

export async function useServer(
  dataDir: string,
  serverConfig: PostgresRuntimeConfig,
  stdio?: Stdio
): Promise<Server>

export async function useServer(
  dataDir: string,
  serverConfig: PostgresRuntimeConfig,
  stdio: Stdio,
  callback: (port: number) => Promise<void>
): Promise<void>

export async function useServer(
  dataDir: string,
  serverConfig: PostgresRuntimeConfig,
  stdio: Stdio = 'inherit',
  callback?: (port: number) => Promise<void>
): Promise<any> {
  let close: () => void

  const { pid, port } = await getPostgresPort(dataDir)
  if (pid) {
    // Leave the server running if we didn't start it.
    close = () => {}
  } else {
    const proc = exec(
      `postgres -D "${dataDir}" -p ${port}`,
      getConfigFlags(serverConfig),
      typeof stdio == 'function' ? stdio : { stdio }
    )

    await pollForVersion(port)

    close = () =>
      new Promise((resolve, reject) => {
        proc.on('close', resolve)
        proc.on('error', reject)
        proc.kill('SIGINT')
      })
  }

  if (!callback) {
    return {
      port,
      close,
    }
  }

  try {
    await callback(port)
  } finally {
    close()
  }
}

export async function useDevServer(
  name: string,
  dataDir: string,
  serverConfig: PostgresRuntimeConfig,
  seedScripts?: string[],
  stdio: Stdio = 'inherit'
) {
  const isNewDatabase = await initDataDir(dataDir, stdio)
  const server = await useServer(dataDir, serverConfig, stdio)
  if (isNewDatabase) {
    await createSuperUser(os.userInfo().username, server.port)
    await createDatabase(name, server.port)
    if (seedScripts) {
      for (const seedScript of seedScripts) {
        await runSeedScript(seedScript, server.port, name, stdio)
      }
    }
  }
  return server
}

async function getPostgresPort(
  dataDir: string
): Promise<{ pid?: number; port: number }> {
  const pidFile = path.join(dataDir, 'postmaster.pid')
  try {
    const pidLines = fs.readFileSync(pidFile, 'utf8').split('\n')
    const pid = +pidLines[0]
    const port = +pidLines[3]
    if (await pollForVersion(port, 1)) {
      return { pid, port }
    }
    process.kill(pid, 'SIGINT')
    fs.unlinkSync(pidFile)
  } catch {}

  const port = await getPortPromise({ port: 8432 })

  // For some reason, portfinder doesn't always return a port that's actually
  // available, so we need to check for that here.
  // const procs = await findProc('port', port)
  // procs.forEach(proc => process.kill(proc.pid, 'SIGINT'))

  return { port }
}

async function pollForVersion(port: number, tries = Infinity) {
  while (tries--) {
    try {
      await psql('SELECT version()', port)
      return true
    } catch {
      if (tries > 0) {
        await new Promise(tryAgain => setTimeout(tryAgain, 100))
      }
    }
  }
  return false
}
