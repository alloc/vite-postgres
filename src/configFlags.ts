export type PostgresRuntimeConfig = Record<string, boolean | number | string>

export function getConfigFlags(values: PostgresRuntimeConfig) {
  const flags: string[] = []
  for (const key in values) {
    const value = values[key]
    flags.push(
      `--${key}=` + (value === true ? 'on' : value === false ? 'off' : value)
    )
  }
  return flags
}
