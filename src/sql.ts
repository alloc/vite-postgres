export type InlineScript = string & { sql: true }

/** Use this for inline seed scripts. */
export const sql = (strings: TemplateStringsArray, ...values: any[]) => {
  const script = new String(
    strings.reduce((sql, string, i) => sql + string + (values[i] ?? ''), '')
  ) as InlineScript
  script.sql = true
  return script
}

export const isInlineScript = (script: any): script is InlineScript =>
  script instanceof String && 'sql' in script
