import fs from 'fs'
import { promisify } from 'util'

export function removeDataDir(dataDir: string) {
  return promisify(fs.rm)(dataDir, {
    force: true,
    recursive: true,
  })
}
