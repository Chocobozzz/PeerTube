import { buildUUID } from '@peertube/peertube-node-utils'
import { createLogger } from '@server/helpers/logger.js'
import { isSecondaryProcess } from '@server/initializers/process-role.js'
import {
  buildPluginPrimaryResponsesChannel,
  currentProcessId,
  PluginPrimaryRequestPayload,
  PluginPrimaryResponsePayload,
  RedisChannels
} from '../redis/index.js'
import { isRedisInitialized } from '../redis/redis-client.js'

const logger = createLogger('plugin')

const DEFAULT_TIMEOUT = 30000

export type PluginPrimaryHandler = (payload: any) => unknown

type PendingRequest = {
  resolve: (result: unknown) => void
  reject: (err: Error) => void
  timer: NodeJS.Timeout
}

export class PluginPrimaryRPC {
  private static instance: PluginPrimaryRPC

  private readonly handlers = new Map<string, Map<string, PluginPrimaryHandler>>()

  private readonly pendingRequests = new Map<string, PendingRequest>()
  private responsesSubscription: Promise<void>

  private constructor () {}

  registerHandler (npmName: string, name: string, handler: PluginPrimaryHandler) {
    if (!this.handlers.has(npmName)) this.handlers.set(npmName, new Map())

    this.handlers.get(npmName).set(name, handler)
  }

  unregisterHandlers (npmName: string) {
    this.handlers.delete(npmName)
  }

  async listenForRequestsOnPrimary () {
    await RedisChannels.pluginPrimaryRequests.subscribe(request => this.onRequestOnPrimary(request))
  }

  async call (options: {
    npmName: string
    name: string
    payload?: unknown
    timeout?: number // default 30s
  }): Promise<unknown> {
    const { npmName, name, payload, timeout = DEFAULT_TIMEOUT } = options

    if (!isSecondaryProcess()) return cloneJSON(await this.runHandler(npmName, name, cloneJSON(payload ?? null)))

    if (!isRedisInitialized()) throw new Error('Cannot call the primary process: Redis is not initialized')

    if (this.responsesSubscription === undefined) {
      this.responsesSubscription = buildPluginPrimaryResponsesChannel(currentProcessId)
        .subscribe(response => this.onResponse(response))
        .catch(err => {
          this.responsesSubscription = undefined
          throw err
        })
    }
    await this.responsesSubscription

    const requestId = buildUUID()

    const result = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Primary handler ${name} of plugin ${npmName} did not answer within ${timeout}ms`))
      }, timeout)

      this.pendingRequests.set(requestId, { resolve, reject, timer })
    })

    try {
      const receivers = await RedisChannels.pluginPrimaryRequests.publish({
        requestId,
        senderId: currentProcessId,
        npmName,
        name,
        payload: payload ?? null
      })

      if (receivers === 0) throw new Error('Cannot call the primary process: it is not listening (not started yet?)')
    } catch (err) {
      this.settle(requestId, { requestId, error: (err as Error).message })
    }

    return result
  }

  private async onRequestOnPrimary (request: PluginPrimaryRequestPayload) {
    const { requestId, senderId, npmName, name } = request

    let response: PluginPrimaryResponsePayload

    try {
      logger.debug('Running primary handler %s of plugin %s for process %s.', name, npmName, senderId)

      response = { requestId, result: await this.runHandler(npmName, name, request.payload) }
    } catch (err) {
      logger.debug('Error in primary handler %s of plugin %s.', name, npmName, { err })

      response = { requestId, error: (err as Error)?.message || String(err) }
    }

    await buildPluginPrimaryResponsesChannel(senderId).publish(response)
  }

  private onResponse (response: PluginPrimaryResponsePayload) {
    this.settle(response?.requestId, response)
  }

  private settle (requestId: string, response: PluginPrimaryResponsePayload) {
    const pending = this.pendingRequests.get(requestId)
    if (!pending) return

    this.pendingRequests.delete(requestId)
    clearTimeout(pending.timer)

    if (response.error !== undefined) return pending.reject(new Error(response.error))

    pending.resolve(response.result)
  }

  private runHandler (npmName: string, name: string, payload: unknown) {
    const handler = this.handlers.get(npmName)?.get(name)
    if (!handler) throw new Error(`Unknown primary handler ${name} of plugin ${npmName}`)

    return handler(payload)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

function cloneJSON (value: unknown) {
  if (value === undefined) return undefined

  return JSON.parse(JSON.stringify(value))
}
