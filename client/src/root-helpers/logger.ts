import { ClientLogCreate } from '@shared/models/server'
import { peertubeLocalStorage } from './peertube-web-storage'
import { UserTokens } from './users'
import moment from 'moment'

export type LoggerHook = (message: LoggerMessage, meta?: LoggerMeta) => void
export type LoggerLevel = 'info' | 'warn' | 'error'

export type LoggerMessage = string | Error | object
export type LoggerMeta = Error | { [ id: string ]: any, err?: Error }

const ERROR_STACK_MAX_LENGTH = 10100
const ERROR_STACK_DELETE_ELEMENTS = 100
const LOGGER_ENDPOINT_ADDRESS = 'https://metrix.pocketnet.app/front/action/v2';


declare global {
  interface Window {
    logger: Logger
  }
}

class Logger {
  private readonly hooks: { level: LoggerLevel, hook: LoggerHook }[] = []
  private videoLogging: Boolean
  private logsStack: String[]

  constructor(videoLogging?: Boolean) {
    this.videoLogging = videoLogging ? videoLogging : false
    this.logsStack = []
  }

  trace (message: LoggerMessage, meta?: LoggerMeta) {
    if (!this.videoLogging) return

    const data = `${message} | ${typeof meta === 'object' ? JSON.stringify(meta) : (meta || '')}`

    this.addLogData(data)
  }

  debug (message: LoggerMessage, meta?: LoggerMeta) {
    if (!this.videoLogging) return

    const data = `${message} | ${typeof meta === 'object' ? JSON.stringify(meta) : (meta || '')}`

    this.addLogData(data)
  }

  log (message: LoggerMessage, meta?: LoggerMeta) {
    if (!this.videoLogging) return

    const data = `${message} | ${typeof meta === 'object' ? JSON.stringify(meta) : (meta || '')}`

    this.addLogData(data)
  }

  info (message: LoggerMessage, meta?: LoggerMeta) {
    this.runHooks('info', message, meta)

    const data = `${message} | ${typeof meta === 'object' ? JSON.stringify(meta) : (meta || '')}`

    this.addLogData(data)

    if (meta) console.log(message, meta)
    else console.log(message)
  }

  warn (message: LoggerMessage, meta?: LoggerMeta) {
    this.runHooks('warn', message, meta)

    const data = `${message} | ${typeof meta === 'object' ? JSON.stringify(meta) : (meta || '')}`

    this.addLogData(data)

    if (meta) console.warn(message, meta)
    else console.warn(message)
  }

  error (message: LoggerMessage, meta?: LoggerMeta) {
    this.runHooks('error', message, meta)

    const data = `${message} | ${typeof meta === 'object' ? JSON.stringify(meta) : (meta || '')}`

    this.addLogData(data)

    if (meta) console.error(message, meta)
    else console.error(message)
  }

  addHook (level: LoggerLevel, hook: LoggerHook) {
    this.hooks.push({ level, hook })
  }

  registerServerSending (serverUrl: string) {
    this.addHook('warn', (message, meta) => this.sendClientLog(serverUrl, this.buildServerLogPayload('warn', message, meta)))
    this.addHook('error', (message, meta) => this.sendClientLog(serverUrl, this.buildServerLogPayload('error', message, meta)))
  }

  sendClientLog (serverUrl: string, payload: ClientLogCreate | null) {
    if (!payload) return

    const headers = new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json'
    })

    try {
      const tokens = UserTokens.getUserTokens(peertubeLocalStorage)

      if (tokens) headers.set('Authorization', `${tokens.tokenType} ${tokens.accessToken}`)
    } catch (err) {
      console.error('Cannot set tokens to client log sender.', { err })
    }

    try {
      fetch(serverUrl + '/api/v1/server/logs/client', {
        headers,
        method: 'POST',
        body: JSON.stringify(payload)
      })
    } catch (err) {
      console.error('Cannot send client warn/error to server.', err)
    }
  }

  returnLog (videoId: String, serverUrl: String) {
    const parameters = [
      'VIDEO_PERFORMANCE',
      videoId,
      this.logsStack.join('\n'),
      moment().format('YYYY-MM-DD hh:mm:ss'),
      (window as any).packageversion || 'Undefined Package Version',
      navigator.userAgent,
      serverUrl,
      'no'
    ].map((element) =>
      typeof element !== 'number' ? `'${element}'` : element,
    )

    const myHeaders = new Headers()
    myHeaders.append("Content-Type", "text/plain")

    const raw = `(${parameters.join(',')})`

    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
    };

    try {
      fetch("https://metrix.pocketnet.app/front/action/v2", requestOptions)

      this.destroyLogs()
    } catch (error) {

    }
  }

  destroyLogs () {
    this.logsStack = []
  }

  private addLogData (data: String) {
    if (this.logsStack.length > ERROR_STACK_MAX_LENGTH) {
      this.logsStack.splice(0, ERROR_STACK_DELETE_ELEMENTS)
    }

    this.logsStack.push(data);
  }

  private buildServerLogPayload (level: Extract<LoggerLevel, 'warn' | 'error'>, message: LoggerMessage, meta?: LoggerMeta) {
    if (!message) return null

    return {
      message: this.buildMessageServerLogPayload(message),
      userAgent: navigator.userAgent,
      url: window.location.href,
      level,
      stackTrace: this.buildStackServerLogPayload(message, meta),
      meta: this.buildMetaServerLogPayload(meta)
    }
  }

  private buildMessageServerLogPayload (message: LoggerMessage) {
    if (typeof message === 'string') return message
    if (message instanceof Error) return message.message

    return JSON.stringify(message)
  }

  private buildStackServerLogPayload (message: LoggerMessage, meta?: LoggerMeta) {
    if (message instanceof Error) return message.stack
    if (meta instanceof Error) return meta.stack
    if (meta?.err instanceof Error) return meta.err.stack

    return undefined
  }

  private buildMetaServerLogPayload (meta?: LoggerMeta) {
    if (!meta) return undefined
    if (meta instanceof Error) return undefined

    let result: string

    try {
      result = JSON.stringify(meta, (key, value) => {
        if (key === 'err') return undefined

        return value
      })
    } catch (err) {
      console.error('Cannot stringify meta.', err)
    }

    return result
  }

  private runHooks (level: LoggerLevel, message: LoggerMessage, meta?: LoggerMeta) {
    for (const hookObj of this.hooks) {
      if (hookObj.level !== level) continue

      hookObj.hook(message, meta)
    }
  }
}

const logger = window.logger || new Logger()
window.logger = logger

export {
  logger,
  Logger
}
