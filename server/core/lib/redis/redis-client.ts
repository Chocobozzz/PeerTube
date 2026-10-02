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
  addVideoViewerCounter: (...args: (string | number)[]) => Promise<[number, number, number, number]>
  releaseLock: (...args: (string | number)[]) => Promise<number>
  extendLock: (...args: (string | number)[]) => Promise<number>
  incrementRateLimit: (...args: (string | number)[]) => Promise<[number, number]>
}

// ---------------------------------------------------------------------------
// Connection state
// ---------------------------------------------------------------------------

let client: IoRedis
let subscriberClient: IoRedis

// Every connection derived from the main client, so `quitRedisClient()` can close them all
const duplicatedClients: IoRedis[] = []

const subscribedHandlers = new Map<string, Set<(message: string) => void>>()

const connectListeners = new Set<() => void>()

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
  client.defineCommand('releaseLock', { numberOfKeys: 1, lua: readLuaScript('release-lock') })
  client.defineCommand('extendLock', { numberOfKeys: 1, lua: readLuaScript('extend-lock') })
  client.defineCommand('incrementRateLimit', { numberOfKeys: 1, lua: readLuaScript('increment-rate-limit') })

  client.on('error', err => logger.error('Redis failed to connect', { err }))
  client.on('connect', () => {
    logger.info('Connected to redis.')

    connected = true

    for (const listener of connectListeners) {
      try {
        listener()
      } catch (err) {
        logger.error('Error in redis connect listener.', { err })
      }
    }
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

// Called on every connection or reconnectin of the main client
export function onRedisConnect (listener: () => void) {
  connectListeners.add(listener)
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

// Returns the value and the milliseconds before it expires
export async function getValueAndExpiration (key: string) {
  const results = await client.multi()
    .get(prefix + key)
    .pttl(prefix + key)
    .exec()

  throwIfMultiFailed(results)

  return { value: results[0][1] as string, msBeforeExpiration: results[1][1] as number }
}

export function removeValue (key: string) {
  return client.del(prefix + key)
}

// Read and delete in one atomic command, so only one process can consume the value
export function getAndDeleteValue (key: string) {
  return client.getdel(prefix + key)
}

export function getSet (key: string) {
  return client.smembers(prefix + key)
}

export function addToSet (key: string, value: string) {
  return client.sadd(prefix + key, value)
}

export function addValuesToSet (key: string, values: string[]) {
  return client.sadd(prefix + key, ...values)
}

export async function areSetMembers (key: string, values: string[]) {
  if (values.length === 0) return []

  const results = await client.smismember(prefix + key, ...values)

  return results.map(r => r === 1)
}

export async function replaceSet (key: string, values: string[]) {
  const multi = client.multi().del(prefix + key)
  if (values.length !== 0) multi.sadd(prefix + key, ...values)

  throwIfMultiFailed(await multi.exec())
}

// Read and delete in one atomic command
export async function popSetMembers (key: string) {
  const results = await client.multi()
    .smembers(prefix + key)
    .del(prefix + key)
    .exec()

  throwIfMultiFailed(results)

  return results[0][1] as string[]
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

// The expiration is only set by the first increment, so the counter is reset at the end of a fixed window
export async function incrementInWindow (key: string, windowMs: number) {
  const results = await client.multi()
    .set(prefix + key, 0, 'PX', windowMs, 'NX')
    .incr(prefix + key)
    .exec()

  throwIfMultiFailed(results)

  return results[1][1] as number
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
      for (const channelHandler of subscribedHandlers.get(incomingChannel) || []) {
        channelHandler(message)
      }
    })
  }

  const key = prefix + channel

  // Several handlers can listen to the same channel: subscribing twice runs the handler twice
  if (!subscribedHandlers.has(key)) subscribedHandlers.set(key, new Set())
  subscribedHandlers.get(key).add(handler)

  await subscriberClient.subscribe(key)
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

export function runReleaseLock (options: {
  lockKey: string
  token: string
}) {
  return getScriptedRedisClient().releaseLock(prefix + options.lockKey, options.token)
}

export function runExtendLock (options: {
  lockKey: string
  token: string
  ttlMs: number
}) {
  return getScriptedRedisClient().extendLock(prefix + options.lockKey, options.token, options.ttlMs)
}

export function runIncrementRateLimit (options: {
  key: string
  hits: number
  windowMs: number
}) {
  return getScriptedRedisClient().incrementRateLimit(prefix + options.key, options.hits, options.windowMs)
}

// ---------------------------------------------------------------------------
// Locks
// ---------------------------------------------------------------------------

// Returns true if the lock was free and is now held with value
export async function setValueIfNotExists (key: string, value: string, expirationMilliseconds: number) {
  // NX: only set the key if it does not already exist
  const result = await client.set(prefix + key, value, 'PX', expirationMilliseconds, 'NX')

  return result === 'OK'
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function throwIfMultiFailed (results: [Error | null, unknown][] | null) {
  // Null if the transaction was aborted
  if (!results) throw new Error('Redis transaction was aborted.')

  for (const [ err ] of results) {
    if (err) throw err
  }
}

function readLuaScript (name: string) {
  return readFileSync(new URL(`./lua/${name}.lua`, import.meta.url), 'utf-8')
}
