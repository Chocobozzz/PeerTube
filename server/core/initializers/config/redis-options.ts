import type { RedisOptions } from 'ioredis'
import { readFileSync } from 'node:fs'
import type { ConnectionOptions } from 'node:tls'
import type { ConfigInstance } from './config-loader.js'

/**
 * Build the ioredis options from a configuration instance rather than from `CONFIG`.
 *
 * CONFIG uses Redis to build its internal state, so we must use raw config instance
 */
export function buildRedisClientOptions (options: {
  config: ConfigInstance
  name?: string

  // Merged last, so a caller can override anything
  redisOptions?: RedisOptions
}): RedisOptions {
  const { config, name = '', redisOptions = {} } = options

  const get = <T>(property: string, fallback?: T): T => {
    return config.has(property)
      ? config.get<T>(property)
      : fallback
  }

  const connectionName = [ 'PeerTube', name ].join('')
  // Could be slow since node use sync calls to compile and load PeerTube modules
  const connectTimeout = 20000

  if (get<boolean>('redis.sentinel.enabled', false) === true) {
    return {
      connectionName,
      connectTimeout,
      enableTLSForSentinelMode: get<boolean>('redis.sentinel.enable_tls', false),
      sentinelTLS: buildTLS(config, 'redis.sentinel.enable_tls', 'redis.sentinel.tls_settings'),
      sentinelPassword: get<string>('redis.sentinel.password', null),
      password: get<string>('redis.auth', null),
      sentinels: get<{ host: string, port: number }[]>('redis.sentinel.sentinels', []),
      name: get<string>('redis.sentinel.master_name', null),

      ...redisOptions
    }
  }

  return {
    connectionName,
    connectTimeout,
    password: get<string>('redis.auth', null),
    db: get<number>('redis.db', null),
    host: get<string>('redis.hostname', null),
    port: get<number>('redis.port', null),
    path: get<string>('redis.socket', null),
    showFriendlyErrorStack: true,
    tls: buildTLS(config, 'redis.enable_tls', 'redis.tls_settings'),

    ...redisOptions
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildTLS (config: ConfigInstance, enabledProperty: string, settingsProperty: string): ConnectionOptions {
  const enabled = config.has(enabledProperty)
    ? config.get<boolean>(enabledProperty)
    : false

  if (!enabled) return undefined

  const get = (property: string) => {
    const full = settingsProperty + '.' + property

    return config.has(full)
      ? config.get<string>(full)
      : null
  }

  const tls: ConnectionOptions = {
    rejectUnauthorized: config.has(settingsProperty + '.reject_unauthorized')
      ? config.get<boolean>(settingsProperty + '.reject_unauthorized')
      : false
  }

  for (const field of [ 'ca', 'cert', 'key' ] as const) {
    const path = get(field)
    if (path) tls[field] = readFileSync(path, { encoding: 'utf8' })
  }

  return tls
}
