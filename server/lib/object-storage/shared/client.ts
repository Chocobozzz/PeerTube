import { S3Client } from '@aws-sdk/client-s3'
import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { lTags } from './logger'

const endpointConfig = CONFIG.OBJECT_STORAGE.ENDPOINT
const endpoint = endpointConfig.startsWith('http://') || endpointConfig.startsWith('https://')
  ? CONFIG.OBJECT_STORAGE.ENDPOINT
  : 'https://' + CONFIG.OBJECT_STORAGE.ENDPOINT
const endpointParsed = new URL(endpoint)

let s3Client: S3Client
function getClient () {
  if (s3Client) return s3Client

  const OBJECT_STORAGE = CONFIG.OBJECT_STORAGE

  s3Client = new S3Client({
    endpoint,
    region: OBJECT_STORAGE.REGION,
    credentials: {
      accessKeyId: OBJECT_STORAGE.CREDENTIALS.ACCESS_KEY_ID,
      secretAccessKey: OBJECT_STORAGE.CREDENTIALS.SECRET_ACCESS_KEY
    }
  })

  logger.info('Initialized S3 client %s with region %s.', endpoint, OBJECT_STORAGE.REGION, lTags())

  return s3Client
}

export {
  endpoint,
  endpointParsed,
  getClient
}
