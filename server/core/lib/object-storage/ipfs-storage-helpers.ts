import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { createReadStream, createWriteStream } from 'fs'
import { ensureDir } from 'fs-extra/esm'
import { dirname } from 'path'
import { Readable } from 'stream'
import { getHeliaClient } from './shared/ipfs-client.js'
import { lTags } from './shared/logger.js'
import type { CID } from 'multiformats'

export type IPFSBucketInfo = {
  BUCKET_NAME: string
  PREFIX?: string
}

/**
 * Store a file in IPFS from a local path
 */
export async function storeObjectInIPFS (options: {
  inputPath: string
  bucketInfo: IPFSBucketInfo
}): Promise<string> {
  const { inputPath, bucketInfo } = options

  logger.debug('Uploading file %s to IPFS bucket %s', inputPath, bucketInfo.BUCKET_NAME, lTags())

  const fileStream = createReadStream(inputPath)
  return uploadToIPFS({ content: fileStream, bucketInfo })
}

/**
 * Store string content in IPFS
 */
export async function storeContentInIPFS (options: {
  content: string
  bucketInfo: IPFSBucketInfo
}): Promise<string> {
  const { content, bucketInfo } = options

  logger.debug('Uploading content to IPFS bucket %s', bucketInfo.BUCKET_NAME, lTags())

  return uploadToIPFS({ content, bucketInfo })
}

/**
 * Store a stream in IPFS
 */
export async function storeStreamInIPFS (options: {
  stream: Readable
  bucketInfo: IPFSBucketInfo
}): Promise<string> {
  const { stream, bucketInfo } = options

  logger.debug('Streaming file to IPFS bucket %s', bucketInfo.BUCKET_NAME, lTags())

  return uploadToIPFS({ content: stream, bucketInfo })
}

/**
 * Retrieve a file from IPFS and save to local path
 */
export async function makeAvailableFromIPFS (options: {
  cid: string
  destination: string
  bucketInfo: IPFSBucketInfo
}): Promise<void> {
  const { cid, destination } = options

  await ensureDir(dirname(destination))

  logger.debug('Downloading file from IPFS CID %s to %s', cid, destination, lTags())

  try {
    const { fs } = await getHeliaClient()
    const { CID } = await import('multiformats')
    
    const parsedCID = CID.parse(cid)
    const file = createWriteStream(destination)

    // Stream the file from IPFS
    for await (const chunk of fs.cat(parsedCID)) {
      file.write(chunk)
    }

    file.close()
    logger.debug('Successfully downloaded file from IPFS CID %s', cid, lTags())
  } catch (err) {
    logger.error('Failed to download file from IPFS', { cid, err, ...lTags() })
    throw err
  }
}

/**
 * Create a readable stream from IPFS
 */
export async function createIPFSReadStream (options: {
  cid: string
  bucketInfo: IPFSBucketInfo
}): Promise<Readable> {
  const { cid } = options

  logger.debug('Creating read stream for IPFS CID %s', cid, lTags())

  try {
    const { fs } = await getHeliaClient()
    const { CID } = await import('multiformats')
    
    const parsedCID = CID.parse(cid)
    
    // Convert async iterable to readable stream
    const stream = new Readable({
      async read () {
        try {
          for await (const chunk of fs.cat(parsedCID)) {
            if (!this.push(chunk)) {
              break
            }
          }
          this.push(null)
        } catch (err) {
          this.destroy(err as Error)
        }
      }
    })

    return stream
  } catch (err) {
    logger.error('Failed to create read stream from IPFS', { cid, err, ...lTags() })
    throw err
  }
}

/**
 * Remove a file from IPFS (unpins it)
 */
export async function removeObjectFromIPFS (cid: string, bucketInfo: IPFSBucketInfo): Promise<void> {
  logger.debug('Unpinning file %s from IPFS bucket %s', cid, bucketInfo.BUCKET_NAME, lTags())

  try {
    const { helia } = await getHeliaClient()
    const { CID } = await import('multiformats')
    
    const parsedCID = CID.parse(cid)
    await helia.pins.rm(parsedCID)
    
    logger.debug('Successfully unpinned CID %s from IPFS', cid, lTags())
  } catch (err) {
    logger.error('Failed to unpin from IPFS', { cid, err, ...lTags() })
    throw err
  }
}

/**
 * Get the size of a file stored in IPFS
 */
export async function getIPFSFileSize (options: {
  cid: string
  bucketInfo: IPFSBucketInfo
}): Promise<number> {
  const { cid } = options

  try {
    const { fs } = await getHeliaClient()
    const { CID } = await import('multiformats')
    
    const parsedCID = CID.parse(cid)
    const stat = await fs.stat(parsedCID)
    
    // Handle different stat types
    if ('fileSize' in stat) {
      return Number(stat.fileSize)
    } else if ('cumulativeSize' in stat) {
      return Number(stat.cumulativeSize)
    } else if ('size' in stat) {
      return Number(stat.size)
    }
    return 0
  } catch (err) {
    logger.error('Failed to get file size from IPFS', { cid, err, ...lTags() })
    throw err
  }
}

/**
 * Build IPFS URL for accessing content via gateway
 */
export function buildIPFSUrl (cid: string, bucketInfo: IPFSBucketInfo): string {
  const gateway = CONFIG.IPFS_STORAGE.GATEWAY_URL
  
  // Return gateway URL if configured, otherwise return ipfs:// protocol URL
  if (gateway) {
    return `${gateway}/ipfs/${cid}`
  }
  
  return `ipfs://${cid}`
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function uploadToIPFS (options: {
  content: Readable | string
  bucketInfo: IPFSBucketInfo
}): Promise<string> {
  const { content, bucketInfo } = options

  try {
    const { helia, fs } = await getHeliaClient()
    
    let cid: CID
    
    if (typeof content === 'string') {
      // Upload string content
      const encoder = new TextEncoder()
      const bytes = encoder.encode(content)
      cid = await fs.addBytes(bytes)
    } else {
      // Upload stream
      // Convert Node.js Readable to async iterable of Uint8Arrays
      const asyncIterable = (async function* () {
        for await (const chunk of content) {
          yield chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
        }
      })()
      
      cid = await fs.addFile({ path: 'file', content: asyncIterable })
    }

    // Pin the content to ensure it persists
    await helia.pins.add(cid)

    const cidString = cid.toString()
    logger.debug(
      'Completed upload to IPFS in bucket %s with CID %s',
      bucketInfo.BUCKET_NAME,
      cidString,
      lTags()
    )

    return buildIPFSUrl(cidString, bucketInfo)
  } catch (err) {
    logger.error('Failed to upload to IPFS', { err, ...lTags() })
    throw err
  }
}
