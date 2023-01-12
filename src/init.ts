import exec from '@cush/exec'
import * as fs from 'fs'
import { psql } from './seed'
import type { Stdio } from './server'

export async function initDataDir(dataDir: string, stdio: Stdio = 'inherit') {
  const isNewDatabase = !fs.existsSync(dataDir)
  if (isNewDatabase) {
    await exec(
      `initdb -D "${dataDir}" -U postgres`,
      typeof stdio !== 'function' ? { stdio } : {}
    )
  }
  return isNewDatabase
}

export const createSuperUser = (
  username: string,
  port: number,
  stdio: Stdio = 'inherit'
) =>
  exec(
    `createuser -U postgres -p ${port} -s ${username}`,
    typeof stdio !== 'function' ? { stdio } : {}
  )

export const createDatabase = (
  name: string,
  port: number,
  stdio: Stdio = 'inherit'
) => psql('CREATE DATABASE ' + name, port, 'postgres', stdio)
