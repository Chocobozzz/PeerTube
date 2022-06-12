import { S3Client } from '@aws-sdk/client-s3'
import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { lTags } from './logger'

let endpointParsed: URL
function getEndpointParsed () {
  if (endpointParsed) return endpointParsed

  endpointParsed = new URL(getEndpoint())

  return endpointParsed
}

let s3Client: S3Client
function getClient () {
  if (s3Client) return s3Client

  const OBJECT_STORAGE = CONFIG.OBJECT_STORAGE

  s3Client = new S3Client({
    endpoint: getEndpoint(),
    region: OBJECT_STORAGE.REGION,
    credentials: OBJECT_STORAGE.CREDENTIALS.ACCESS_KEY_ID
      ? {
        accessKeyId: OBJECT_STORAGE.CREDENTIALS.ACCESS_KEY_ID,
        secretAccessKey: OBJECT_STORAGE.CREDENTIALS.SECRET_ACCESS_KEY
      }
      : undefined
  })

  logger.info('Initialized S3 client %s with region %s.', getEndpoint(), OBJECT_STORAGE.REGION, lTags())

  return s3Client
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
