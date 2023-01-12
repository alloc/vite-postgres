import exec from '@cush/exec'
import fs from 'fs'
import { Module } from 'module'
import path from 'path'
import vm from 'vm'
import { InlineScript, isInlineScript } from './sql'

export async function runSeedScript(
  script: string | InlineScript,
  port: number,
  database: string,
  stdio: any
) {
  if (isInlineScript(script)) {
    await psql(script, port, database, stdio)
  } else if (script.endsWith('sql')) {
    await exec(`psql -d ${database} -p ${port} -f "${script}"`, { stdio })
  } else {
    const runScript = await compileScript(script)
    const oldEnv = { PGPORT: '', PGDATABASE: '', ...process.env }
    process.env.PGPORT = String(port)
    process.env.PGDATABASE = database
    try {
      await runScript()
    } finally {
      Object.assign(process.env, oldEnv)
    }
  }
}

/** Execute a SQL string with `psql` binary. */
export const psql = (
  script: string,
  port: number,
  database = 'postgres',
  stdio?: any
) =>
  exec(`psql -U postgres -d ${database} -p ${port} -c "${script}"`, { stdio })

async function compileScript(filename: string) {
  let script = fs.readFileSync(filename, 'utf8')
  if (filename.endsWith('ts')) {
    const sucrase = await import('sucrase')
    const result = sucrase.transform(script, {
      transforms: ['typescript', 'imports'],
      filePath: filename,
      sourceMapOptions: {
        compiledFilename: filename,
      },
    })
    script = wrapInAsyncFunction(result.code)
    script += toInlineSourceMap(result.sourceMap!)
    // Ensure dependencies are compiled too.
    require('sucrase/register/ts')
  } else {
    script = wrapInAsyncFunction(script)
  }
  const compiledScript = new vm.Script(script, {
    filename,
    lineOffset: 1,
  })
  return compiledScript
    .runInThisContext()
    .bind(
      null,
      Module.createRequire(filename),
      filename,
      path.dirname(filename)
    ) as () => Promise<void>
}

function wrapInAsyncFunction(code: string) {
  return `(0, async function(require, __filename, __dirname) {${code}\n})`
}

function toInlineSourceMap(map: object) {
  return (
    '\n//# ' +
    'sourceMappingURL=data:application/json;charset=utf-8;base64,' +
    Buffer.from(JSON.stringify(map), 'utf8').toString('base64')
  )
}
