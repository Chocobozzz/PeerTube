import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { bootstrap } from '@libp2p/bootstrap'
import { FsBlockstore } from 'blockstore-fs'
import { FsDatastore } from 'datastore-fs'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { join } from 'path'
import { ensureDir } from 'fs-extra/esm'
import type { Helia } from 'helia'
import type { UnixFS } from '@helia/unixfs'

let heliaInstance: Helia | null = null
let unixfsInstance: UnixFS | null = null
let initializationPromise: Promise<void> | null = null

// Polyfill `Promise.withResolvers` for Node versions/environments
// where it's not available (some libp2p/mortice versions call it).
// This keeps the runtime compatible when Node is older than the API.
if (typeof (Promise as any).withResolvers !== 'function') {
  ;(Promise as any).withResolvers = function () {
    let resolve: (value?: any) => void = () => {}
    let reject: (reason?: any) => void = () => {}
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

/**
 * Initialize and return a singleton Helia IPFS node
 */
export async function getHeliaClient (): Promise<{ helia: Helia, fs: UnixFS }> {
  if (heliaInstance && unixfsInstance) {
    return { helia: heliaInstance, fs: unixfsInstance }
  }

  if (initializationPromise) {
    await initializationPromise
    return { helia: heliaInstance!, fs: unixfsInstance! }
  }

  initializationPromise = initializeHelia()
  await initializationPromise
  
  return { helia: heliaInstance!, fs: unixfsInstance! }
}

async function initializeHelia (): Promise<void> {
  try {
    logger.info('Initializing Helia IPFS node...')

    const ipfsConfig = CONFIG.IPFS_STORAGE
    const repoPath = ipfsConfig.REPO_PATH || join(CONFIG.STORAGE.TMP_DIR, 'ipfs-repo')
    
    // Ensure repo directory exists
    await ensureDir(repoPath)
    await ensureDir(join(repoPath, 'blocks'))
    await ensureDir(join(repoPath, 'datastore'))

    // Create blockstore and datastore
    const blockstore = new FsBlockstore(join(repoPath, 'blocks'))
    const datastore = new FsDatastore(join(repoPath, 'datastore'))

    // Configure libp2p
    const libp2pConfig: any = {
      addresses: {
        listen: ipfsConfig.LISTEN_ADDRESSES || ['/ip4/0.0.0.0/tcp/0']
      },
      transports: [tcp()],
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      peerDiscovery: ipfsConfig.BOOTSTRAP_PEERS?.length > 0
        ? [bootstrap({ list: ipfsConfig.BOOTSTRAP_PEERS })]
        : []
    }

    const libp2p = await createLibp2p(libp2pConfig)

    // Create Helia instance
    heliaInstance = await createHelia({
      libp2p,
      blockstore,
      datastore
    })

    // Create UnixFS instance
    unixfsInstance = unixfs(heliaInstance)

    logger.info('Helia IPFS node initialized successfully', {
      peerId: heliaInstance.libp2p.peerId.toString(),
      repoPath
    })
  } catch (err) {
    logger.error('Failed to initialize Helia IPFS node', { err })
    throw err
  }
}

/**
 * Stop the Helia node
 */
export async function stopHeliaClient (): Promise<void> {
  if (!heliaInstance) return

  try {
    logger.info('Stopping Helia IPFS node...')
    await heliaInstance.stop()
    heliaInstance = null
    unixfsInstance = null
    initializationPromise = null
    logger.info('Helia IPFS node stopped successfully')
  } catch (err) {
    logger.error('Failed to stop Helia IPFS node', { err })
    throw err
  }
}

/**
 * Check if Helia client is initialized
 */
export function isHeliaInitialized (): boolean {
  return heliaInstance !== null && unixfsInstance !== null
}
