import { isTestOrDevInstance, sanitizeHost } from '@peertube/peertube-node-utils'
import { decrypt, encrypt } from '../../helpers/encryption.js'

export function buildRemoteHttpScheme () {
  if (process.env.PRODUCTION_CONSTANTS !== 'true' && isTestOrDevInstance()) {
    return 'http'
  }

  return 'https'
}

export function buildRemoteWsScheme () {
  if (process.env.PRODUCTION_CONSTANTS !== 'true' && isTestOrDevInstance()) {
    return 'ws'
  }

  return 'wss'
}

export function buildInstanceHost (options: {
  hostname: string
  port: number
}) {
  const { hostname, port } = options

  return sanitizeHost(hostname + ':' + port, buildRemoteHttpScheme())
}

// ---------------------------------------------------------------------------

// Redis key and pub/sub channel carrying the instance configuration
export const SHARED_CONFIG_REDIS_KEY = 'shared-config'
export const SHARED_CONFIG_REDIS_CHANNEL = 'shared-config-changed'

// ---------------------------------------------------------------------------

// Read from the local configuration files of each process, never overridden by the primary
export const LOCAL_CONFIG_KEYS = new Set([
  'listen',

  // Must be identical on every process: it is the public host that identifies the instance
  'webserver',

  // Signs tokens and hashes viewer session ids, so it must be identical on every process too
  'secrets',

  // Decides req.ip, which feeds the viewer session id hash
  'trust_proxy',

  // Infrastructure and credentials
  'database',
  'redis',

  // Per process paths
  'storage',
  'log',

  // The Prometheus exporter binds a port, so two processes of the same host cannot share it
  'open_telemetry'
])

// ---------------------------------------------------------------------------

export type PublishedConfigPayload = {
  instance: string
  config: any
}

// The payload is encrypted with `secrets.peertube`, which every process of the instance must share
export function encodePublishedConfig (payload: PublishedConfigPayload, secret: string) {
  return encrypt(JSON.stringify(payload), secret)
}

export async function decodePublishedConfig (encrypted: string, secret: string) {
  return JSON.parse(await decrypt(encrypted, secret)) as PublishedConfigPayload
}

// ---------------------------------------------------------------------------

export function buildPublishableConfig (fullConfig: object) {
  const result: any = {}

  for (const [ key, value ] of Object.entries(fullConfig)) {
    if (LOCAL_CONFIG_KEYS.has(key)) continue

    result[key] = value
  }

  return result
}

// In memory configuration published by the primary process
let publishedConfig: object

export function setPublishedConfig (config: object) {
  for (const localKey of LOCAL_CONFIG_KEYS) {
    delete (config as any)[localKey]
  }

  publishedConfig = config
}

export function getPublishedConfig () {
  return publishedConfig
}
