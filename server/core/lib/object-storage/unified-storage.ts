import { CONFIG } from '@server/initializers/config.js'
import { Readable } from 'stream'
import type { BucketInfo } from './object-storage-helpers.js'
import type { IPFSBucketInfo } from './ipfs-storage-helpers.js'

/**
 * Unified storage service that routes to either S3 or IPFS based on configuration
 */

export enum StorageBackend {
  S3 = 's3',
  IPFS = 'ipfs'
}

export function getStorageBackend (): StorageBackend {
  // IPFS takes precedence if enabled
  if (CONFIG.IPFS_STORAGE.ENABLED) {
    return StorageBackend.IPFS
  }
  
  if (CONFIG.OBJECT_STORAGE.ENABLED) {
    return StorageBackend.S3
  }
  
  throw new Error('No storage backend is enabled. Enable either object_storage or ipfs_storage in configuration.')
}

export async function storeObjectUnified (options: {
  inputPath: string
  objectStorageKey: string
  bucketInfo: BucketInfo | IPFSBucketInfo
  isPrivate: boolean
  contentType: string
}): Promise<string> {
  const backend = getStorageBackend()
  
  if (backend === StorageBackend.IPFS) {
    const { storeObjectInIPFS } = await import('./ipfs-storage-helpers.js')
    return storeObjectInIPFS({
      inputPath: options.inputPath,
      bucketInfo: options.bucketInfo as IPFSBucketInfo
    })
  } else {
    const { storeObject } = await import('./object-storage-helpers.js')
    return storeObject(options)
  }
}

export async function storeContentUnified (options: {
  content: string
  objectStorageKey: string
  bucketInfo: BucketInfo | IPFSBucketInfo
  isPrivate: boolean
  contentType: string
}): Promise<string> {
  const backend = getStorageBackend()
  
  if (backend === StorageBackend.IPFS) {
    const { storeContentInIPFS } = await import('./ipfs-storage-helpers.js')
    return storeContentInIPFS({
      content: options.content,
      bucketInfo: options.bucketInfo as IPFSBucketInfo
    })
  } else {
    const { storeContent } = await import('./object-storage-helpers.js')
    return storeContent(options)
  }
}

export async function storeStreamUnified (options: {
  stream: Readable
  objectStorageKey: string
  bucketInfo: BucketInfo | IPFSBucketInfo
  isPrivate: boolean
  contentType: string
}): Promise<string> {
  const backend = getStorageBackend()
  
  if (backend === StorageBackend.IPFS) {
    const { storeStreamInIPFS } = await import('./ipfs-storage-helpers.js')
    return storeStreamInIPFS({
      stream: options.stream,
      bucketInfo: options.bucketInfo as IPFSBucketInfo
    })
  } else {
    const { storeStream } = await import('./object-storage-helpers.js')
    return storeStream(options)
  }
}

export async function makeAvailableUnified (options: {
  key: string
  destination: string
  bucketInfo: BucketInfo | IPFSBucketInfo
}): Promise<void> {
  const backend = getStorageBackend()
  
  if (backend === StorageBackend.IPFS) {
    const { makeAvailableFromIPFS } = await import('./ipfs-storage-helpers.js')
    return makeAvailableFromIPFS({
      cid: options.key,
      destination: options.destination,
      bucketInfo: options.bucketInfo as IPFSBucketInfo
    })
  } else {
    const { makeAvailable } = await import('./object-storage-helpers.js')
    return makeAvailable(options)
  }
}

export async function createObjectReadStreamUnified (options: {
  key: string
  bucketInfo: BucketInfo | IPFSBucketInfo
  rangeHeader: string
}): Promise<{ response: any, stream: Readable }> {
  const backend = getStorageBackend()
  
  if (backend === StorageBackend.IPFS) {
    const { createIPFSReadStream } = await import('./ipfs-storage-helpers.js')
    const stream = await createIPFSReadStream({
      cid: options.key,
      bucketInfo: options.bucketInfo as IPFSBucketInfo
    })
    return { response: {}, stream }
  } else {
    const { createObjectReadStream } = await import('./object-storage-helpers.js')
    return createObjectReadStream(options)
  }
}

export async function removeObjectUnified (key: string, bucketInfo: BucketInfo | IPFSBucketInfo): Promise<void> {
  const backend = getStorageBackend()
  
  if (backend === StorageBackend.IPFS) {
    const { removeObjectFromIPFS } = await import('./ipfs-storage-helpers.js')
    await removeObjectFromIPFS(key, bucketInfo as IPFSBucketInfo)
  } else {
    const { removeObject } = await import('./object-storage-helpers.js')
    await removeObject(key, bucketInfo as BucketInfo)
  }
}

export async function getObjectStorageFileSizeUnified (options: {
  key: string
  bucketInfo: BucketInfo | IPFSBucketInfo
}): Promise<number> {
  const backend = getStorageBackend()
  
  if (backend === StorageBackend.IPFS) {
    const { getIPFSFileSize } = await import('./ipfs-storage-helpers.js')
    return getIPFSFileSize({
      cid: options.key,
      bucketInfo: options.bucketInfo as IPFSBucketInfo
    })
  } else {
    const { getObjectStorageFileSize } = await import('./object-storage-helpers.js')
    return getObjectStorageFileSize(options)
  }
}
