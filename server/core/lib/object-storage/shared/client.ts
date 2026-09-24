import type { S3Client, S3ClientConfig } from '@aws-sdk/client-s3'
import { isProxyEnabled } from '@server/helpers/proxy.js'
import { getProxyAgent } from '@server/helpers/requests.js'
import { CONFIG } from '@server/initializers/config.js'
import type { NodeHttpHandler } from '@smithy/node-http-handler'
import { objectStorageLogger as logger } from './logger.js'

let s3ClientPromise: Promise<S3Client>
export function getClient () {
  if (s3ClientPromise !== undefined) return s3ClientPromise

  s3ClientPromise = (async () => {
    const OBJECT_STORAGE = CONFIG.OBJECT_STORAGE

    const { S3Client } = await import('@aws-sdk/client-s3')

    const NodeHttpHandlerClass = isProxyEnabled()
      ? (await import('@smithy/node-http-handler')).NodeHttpHandler
      : undefined

    const s3Client = new S3Client(buildS3ClientConfig({ NodeHttpHandlerClass }))

    logger.info('Initialized S3 client %s with region %s.', getEndpoint(), OBJECT_STORAGE.REGION)

    return s3Client
  })()

  return s3ClientPromise
}

// Also used by S3 clients we don't instantiate ourselves (uploadx s3 storage for example)
export function buildS3ClientConfig (options: {
  // Only required when a proxy is enabled, to keep `@smithy/node-http-handler` lazy loaded
  NodeHttpHandlerClass?: typeof NodeHttpHandler
}): S3ClientConfig {
  const OBJECT_STORAGE = CONFIG.OBJECT_STORAGE

  return {
    endpoint: getEndpoint(),
    region: OBJECT_STORAGE.REGION,
    credentials: OBJECT_STORAGE.CREDENTIALS.ACCESS_KEY_ID
      ? {
        accessKeyId: OBJECT_STORAGE.CREDENTIALS.ACCESS_KEY_ID,
        secretAccessKey: OBJECT_STORAGE.CREDENTIALS.SECRET_ACCESS_KEY
      }
      : undefined,
    requestHandler: buildProxyRequestHandler(options.NodeHttpHandlerClass),
    maxAttempts: OBJECT_STORAGE.MAX_REQUEST_ATTEMPTS,
    forcePathStyle: OBJECT_STORAGE.FORCE_PATH_STYLE,

    // Default behaviour has incompatibilities with some S3 providers: https://github.com/aws/aws-sdk-js-v3/issues/6810
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED'
  }
}

let endpoint: string
export function getEndpoint () {
  if (endpoint) return endpoint

  const endpointConfig = CONFIG.OBJECT_STORAGE.ENDPOINT
  endpoint = endpointConfig.startsWith('http://') || endpointConfig.startsWith('https://')
    ? CONFIG.OBJECT_STORAGE.ENDPOINT
    : 'https://' + CONFIG.OBJECT_STORAGE.ENDPOINT

  return endpoint
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildProxyRequestHandler (NodeHttpHandlerClass: typeof NodeHttpHandler | undefined) {
  if (!isProxyEnabled()) return undefined
  if (!NodeHttpHandlerClass) throw new Error('NodeHttpHandler class is required to build the S3 client when a proxy is enabled')

  const { agent } = getProxyAgent()

  return new NodeHttpHandlerClass({
    httpAgent: agent.http,
    httpsAgent: agent.https
  })
}
