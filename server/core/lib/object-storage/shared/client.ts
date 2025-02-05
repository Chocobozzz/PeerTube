import type { S3Client } from '@aws-sdk/client-s3'
import { logger } from '@server/helpers/logger.js'
import { isProxyEnabled } from '@server/helpers/proxy.js'
import { getProxyAgent } from '@server/helpers/requests.js'
import { CONFIG } from '@server/initializers/config.js'
import { lTags } from './logger.js'

async function getProxyRequestHandler () {
  if (!isProxyEnabled()) return null

  const { agent } = getProxyAgent()

  const { NodeHttpHandler } = await import('@smithy/node-http-handler')

  return new NodeHttpHandler({
    httpAgent: agent.http,
    httpsAgent: agent.https
  })
}

let endpointParsed: URL
function getEndpointParsed () {
  if (endpointParsed) return endpointParsed

  endpointParsed = new URL(getEndpoint())

  return endpointParsed
}

let s3ClientPromise: Promise<S3Client>
function getClient () {
  if (s3ClientPromise) return s3ClientPromise

  s3ClientPromise = (async () => {
    const OBJECT_STORAGE = CONFIG.OBJECT_STORAGE

    const { S3Client } = await import('@aws-sdk/client-s3')

    const s3Client = new S3Client({
      endpoint: getEndpoint(),
      region: OBJECT_STORAGE.REGION,
      credentials: OBJECT_STORAGE.CREDENTIALS.ACCESS_KEY_ID
        ? {
          accessKeyId: OBJECT_STORAGE.CREDENTIALS.ACCESS_KEY_ID,
          secretAccessKey: OBJECT_STORAGE.CREDENTIALS.SECRET_ACCESS_KEY
        }
        : undefined,
      requestHandler: await getProxyRequestHandler(),
      maxAttempts: CONFIG.OBJECT_STORAGE.MAX_REQUEST_ATTEMPTS,
      // Default behaviour has incompatibilities with some S3 providers: https://github.com/aws/aws-sdk-js-v3/issues/6810
      requestChecksumCalculation: 'WHEN_REQUIRED'
    })

    logger.info('Initialized S3 client %s with region %s.', getEndpoint(), OBJECT_STORAGE.REGION, lTags())

    return s3Client
  })()

  return s3ClientPromise
}

// ---------------------------------------------------------------------------

export {
  getEndpointParsed,
  getClient
}

// ---------------------------------------------------------------------------

let endpoint: string
function getEndpoint () {
  if (endpoint) return endpoint

  const endpointConfig = CONFIG.OBJECT_STORAGE.ENDPOINT
  endpoint = endpointConfig.startsWith('http://') || endpointConfig.startsWith('https://')
    ? CONFIG.OBJECT_STORAGE.ENDPOINT
    : 'https://' + CONFIG.OBJECT_STORAGE.ENDPOINT

  return endpoint
}
