import { ClientLogCreate } from '@peertube/peertube-models'
import { peertubeLocalStorage } from './peertube-web-storage'
import { OAuthUserTokens } from './users'

export type LoggerHook = (message: LoggerMessage, meta?: LoggerMeta) => void
export type LoggerLevel = 'info' | 'warn' | 'error'

export type LoggerMessage = string | Error | object
export type LoggerMeta = Error | { [ id: string ]: any, err?: Error }

declare global {
  interface Window {
    logger: Logger
  }
}

class Logger {
  private readonly hooks: { level: LoggerLevel, hook: LoggerHook }[] = []

  info (message: LoggerMessage, meta?: LoggerMeta) {
    this.runHooks('info', message, meta)

    if (meta) console.log(message, meta)
    else console.log(message)
  }

  warn (message: LoggerMessage, meta?: LoggerMeta) {
    this.runHooks('warn', message, meta)

    this.clientWarn(message, meta)
  }

  clientWarn (message: LoggerMessage, meta?: LoggerMeta) {
    if (meta) console.warn(message, meta)
    else console.warn(message)
  }

  error (message: LoggerMessage, meta?: LoggerMeta) {
    this.runHooks('error', message, meta)

    this.clientError(message, meta)
  }

  clientError (message: LoggerMessage, meta?: LoggerMeta) {
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
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    })

    try {
      const tokens = OAuthUserTokens.getUserTokens(peertubeLocalStorage)

      if (tokens) headers.set('Authorization', `${tokens.tokenType} ${tokens.accessToken}`)
    } catch (err) {
      console.error('Cannot set tokens to client log sender.', { err })
    }

    fetch(serverUrl + '/api/v1/server/logs/client', {
      headers,
      method: 'POST',
      body: JSON.stringify(payload)
    }).catch(err => console.error('Cannot send client warn/error to server.', err))
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
    if (message instanceof Error) return this.buildStack(message)
    if (meta instanceof Error) return this.buildStack(meta)
    if (meta?.err instanceof Error) return this.buildStack(meta.err)

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

  private buildStack (err: Error) {
    return `${err.message}\n${err.stack || ''}`
  }
}

const logger = window.logger || new Logger()
window.logger = logger

export {
  logger
}
