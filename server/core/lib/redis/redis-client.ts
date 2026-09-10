import { Redis as IoRedis, RedisOptions } from 'ioredis'
import { readFileSync } from 'node:fs'
import { createLogger } from '../../helpers/logger.js'
import { CONFIG, getConfigModule } from '../../initializers/config.js'
import { buildRedisClientOptions } from '../../initializers/config/redis-options.js'
import { WEBSERVER } from '../../initializers/constants.js'

const logger = createLogger('redis')

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type StatKind = 'views' | 'downloads'

export type IoRedisWithScripts = IoRedis & {
  mergeLocalVideoViewer: (...args: (string | number)[]) => Promise<[number, number]>
  addVideoViewerCounter: (...args: (string | number)[]) => Promise<[number, number, number]>
}

// ---------------------------------------------------------------------------
// Connection state
// ---------------------------------------------------------------------------

let client: IoRedis
let subscriberClient: IoRedis

// Every connection derived from the main client, so `quitRedisClient()` can close them all
const duplicatedClients: IoRedis[] = []

const subscribedHandlers = new Map<string, (message: string) => void>()

let prefix: string

let initialized = false
let connected = false
let quitting = false

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function initRedisClient () {
  // Already initialized
  if (initialized === true) return
  initialized = true

  quitting = false
  connected = false

  const redisMode = CONFIG.REDIS.SENTINEL.ENABLED ? 'sentinel' : 'standalone'
  logger.info(`Connecting to Redis in "${redisMode}" mode...`)

  client = new IoRedis(buildLoggedRedisClientOptions('', { enableAutoPipelining: true }, true))

  client.defineCommand('mergeLocalVideoViewer', { numberOfKeys: 2, lua: readLuaScript('merge-local-video-viewer') })
  client.defineCommand('addVideoViewerCounter', { numberOfKeys: 2, lua: readLuaScript('add-video-viewer-counter') })

  client.on('error', err => logger.error('Redis failed to connect', { err }))
  client.on('connect', () => {
    logger.info('Connected to redis.')

    connected = true
  })
  client.on('reconnecting', ms => {
    logger.error(`Reconnecting to redis in ${ms}.`)
  })
  client.on('close', () => {
    // Expected when we shut down PeerTube
    if (quitting !== true) logger.error('Connection to redis has closed.')

    connected = false
  })

  client.on('end', () => {
    if (quitting === true) {
      logger.info('Connection to redis has closed.')
      return
    }

    logger.error('Connection to redis has closed and no more reconnects will be done.')
  })

  prefix = 'redis-' + WEBSERVER.HOST + '-'
}

export async function quitRedisClient () {
  if (initialized !== true) return

  initialized = false
  quitting = true

  const clients = [ client, subscriberClient, ...duplicatedClients ].filter(c => !!c)

  subscriberClient = undefined
  duplicatedClients.length = 0
  subscribedHandlers.clear()

  await Promise.all(clients.map(c => c.quit()))
}

// A dedicated connection sharing the options of the main client, closed with it
export function duplicateRedisClient (name: string) {
  const duplicated = client.duplicate()
  duplicated.on('error', err => logger.error(`Error in Redis ${name} client`, { err }))

  duplicatedClients.push(duplicated)

  return duplicated
}

export function getRedisClient () {
  return client
}

function getScriptedRedisClient () {
  return client as IoRedisWithScripts
}

export function getRedisPrefix () {
  return prefix
}

export function isRedisConnected () {
  return connected
}

// CLI scripts and tests load the models without ever connecting to Redis
export function isRedisInitialized () {
  return initialized
}

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export function buildLoggedRedisClientOptions (name?: string, options: RedisOptions = {}, logOptions = false): RedisOptions {
  if (logOptions) {
    if (CONFIG.REDIS.SENTINEL.ENABLED) {
      logger.info(
        `Using sentinel redis options`,
        { sentinels: CONFIG.REDIS.SENTINEL.SENTINELS, name: CONFIG.REDIS.SENTINEL.MASTER_NAME }
      )
    } else {
      logger.info(
        `Using standalone redis options`,
        { db: CONFIG.REDIS.DB, host: CONFIG.REDIS.HOSTNAME, port: CONFIG.REDIS.PORT, path: CONFIG.REDIS.SOCKET }
      )
    }
  }

  // Shared with the bootstrap of a secondary process, which needs Redis before `CONFIG` exists
  return buildRedisClientOptions({ config: getConfigModule(), name, redisOptions: options })
}

// ---------------------------------------------------------------------------
// Prefix-aware low level helpers (were private on the Redis singleton)
// ---------------------------------------------------------------------------

export function getValue (key: string) {
  return client.get(prefix + key)
}

export async function setValue (key: string, value: string, expirationMilliseconds?: number) {
  const result = expirationMilliseconds !== undefined
    ? await client.set(prefix + key, value, 'PX', expirationMilliseconds)
    : await client.set(prefix + key, value)

  if (result !== 'OK') throw new Error('Redis set result is not OK.')
}

export function removeValue (key: string) {
  return client.del(prefix + key)
}

export function getSet (key: string) {
  return client.smembers(prefix + key)
}

export function addToSet (key: string, value: string) {
  return client.sadd(prefix + key, value)
}

export function deleteFromSet (key: string, value: string) {
  return client.srem(prefix + key, value)
}

export function deleteKey (key: string) {
  return client.del(prefix + key)
}

export function increment (key: string) {
  return client.incr(prefix + key)
}

export function incrementHashField (key: string, field: string) {
  return client.hincrby(prefix + key, field, 1)
}

export function getHash (key: string) {
  return client.hgetall(prefix + key)
}

export function setHashField (key: string, field: string, value: string | number) {
  return client.hset(prefix + key, field, value)
}

export function deleteHashFields (key: string, fields: string[]) {
  return client.hdel(prefix + key, ...fields)
}

// Don't collide with `exists` from custom-validators/misc.js
export async function keyExists (key: string) {
  const result = await client.exists(prefix + key)

  return result !== 0
}

export function setExpiration (key: string, ms: number) {
  return client.expire(prefix + key, ms / 1000)
}

// ---------------------------------------------------------------------------
// Pub/sub primitives
// ---------------------------------------------------------------------------

export function publishToRedis (channel: string, message: string) {
  return client.publish(prefix + channel, message)
}

export async function subscribeToRedis (channel: string, handler: (message: string) => void) {
  if (!subscriberClient) {
    // Not in `duplicatedClients`: it is closed explicitly by `quitRedisClient()`
    subscriberClient = client.duplicate()
    subscriberClient.on('error', err => logger.error('Error in Redis subscriber client', { err }))

    subscriberClient.on('message', (incomingChannel, message) => {
      const channelHandler = subscribedHandlers.get(incomingChannel)
      if (channelHandler) channelHandler(message)
    })
  }

  subscribedHandlers.set(prefix + channel, handler)

  await subscriberClient.subscribe(prefix + channel)
}

// ---------------------------------------------------------------------------
// Lua scripted commands (keys are prefixed here, extra ARGV are passed as-is)
// ---------------------------------------------------------------------------

export function runAddVideoViewerCounter (options: {
  videoKey: string
  setKey: string
  args: (string | number)[]
}) {
  return getScriptedRedisClient().addVideoViewerCounter(prefix + options.videoKey, prefix + options.setKey, ...options.args)
}

export function runMergeLocalVideoViewer (options: {
  viewerKey: string
  setKey: string
  args: (string | number)[]
}) {
  return getScriptedRedisClient().mergeLocalVideoViewer(prefix + options.viewerKey, prefix + options.setKey, ...options.args)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function readLuaScript (name: string) {
  return readFileSync(new URL(`./lua/${name}.lua`, import.meta.url), 'utf-8')
}
