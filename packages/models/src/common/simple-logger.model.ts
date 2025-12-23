export type SimpleLogger = {
  info: (msg: string, obj?: object) => void
  debug: (msg: string, obj?: object) => void
  warn: (msg: string, obj?: object) => void
  error: (msg: string, obj?: object) => void
}
