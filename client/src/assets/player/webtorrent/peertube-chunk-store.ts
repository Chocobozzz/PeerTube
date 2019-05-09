// From https://github.com/MinEduTDF/idb-chunk-store
// We use temporary IndexDB (all data are removed on destroy) to avoid RAM issues
// Thanks @santiagogil and @Feross

import { EventEmitter } from 'events'
import Dexie from 'dexie'

class ChunkDatabase extends Dexie {
  chunks: Dexie.Table<{ id: number, buf: Buffer }, number>

  constructor (dbname: string) {
    super(dbname)

    this.version(1).stores({
      chunks: 'id'
    })
  }
}

class ExpirationDatabase extends Dexie {
  databases: Dexie.Table<{ name: string, expiration: number }, number>

  constructor () {
    super('webtorrent-expiration')

    this.version(1).stores({
      databases: 'name,expiration'
    })
  }
}

export class PeertubeChunkStore extends EventEmitter {
  private static readonly BUFFERING_PUT_MS = 1000
  private static readonly CLEANER_INTERVAL_MS = 1000 * 60 // 1 minute
  private static readonly CLEANER_EXPIRATION_MS = 1000 * 60 * 5 // 5 minutes

  chunkLength: number

  private pendingPut: { id: number, buf: Buffer, cb: Function }[] = []
  // If the store is full
  private memoryChunks: { [ id: number ]: Buffer | true } = {}
  private databaseName: string
  private putBulkTimeout: any
  private cleanerInterval: any
  private db: ChunkDatabase
  private expirationDB: ExpirationDatabase
  private readonly length: number
  private readonly lastChunkLength: number
  private readonly lastChunkIndex: number

  constructor (chunkLength: number, opts: any) {
    super()

    this.databaseName = 'webtorrent-chunks-'

    if (!opts) opts = {}
    if (opts.torrent && opts.torrent.infoHash) this.databaseName += opts.torrent.infoHash
    else this.databaseName += '-default'

    this.setMaxListeners(100)

    this.chunkLength = Number(chunkLength)
    if (!this.chunkLength) throw new Error('First argument must be a chunk length')

    this.length = Number(opts.length) || Infinity

    if (this.length !== Infinity) {
      this.lastChunkLength = (this.length % this.chunkLength) || this.chunkLength
      this.lastChunkIndex = Math.ceil(this.length / this.chunkLength) - 1
    }

    this.db = new ChunkDatabase(this.databaseName)
    // Track databases that expired
    this.expirationDB = new ExpirationDatabase()

    this.runCleaner()
  }

  put (index: number, buf: Buffer, cb: (err?: Error) => void) {
    const isLastChunk = (index === this.lastChunkIndex)
    if (isLastChunk && buf.length !== this.lastChunkLength) {
      return this.nextTick(cb, new Error('Last chunk length must be ' + this.lastChunkLength))
    }
    if (!isLastChunk && buf.length !== this.chunkLength) {
      return this.nextTick(cb, new Error('Chunk length must be ' + this.chunkLength))
    }

    // Specify we have this chunk
    this.memoryChunks[index] = true

    // Add it to the pending put
    this.pendingPut.push({ id: index, buf, cb })
    // If it's already planned, return
    if (this.putBulkTimeout) return

    // Plan a future bulk insert
    this.putBulkTimeout = setTimeout(async () => {
      const processing = this.pendingPut
      this.pendingPut = []
      this.putBulkTimeout = undefined

      try {
        await this.db.transaction('rw', this.db.chunks, () => {
          return this.db.chunks.bulkPut(processing.map(p => ({ id: p.id, buf: p.buf })))
        })
      } catch (err) {
        console.log('Cannot bulk insert chunks. Store them in memory.', { err })

        processing.forEach(p => this.memoryChunks[ p.id ] = p.buf)
      } finally {
        processing.forEach(p => p.cb())
      }
    }, PeertubeChunkStore.BUFFERING_PUT_MS)
  }

  get (index: number, opts: any, cb: (err?: Error, buf?: Buffer) => void): void {
    if (typeof opts === 'function') return this.get(index, null, opts)

    // IndexDB could be slow, use our memory index first
    const memoryChunk = this.memoryChunks[index]
    if (memoryChunk === undefined) {
      const err = new Error('Chunk not found') as any
      err['notFound'] = true

      return process.nextTick(() => cb(err))
    }

    // Chunk in memory
    if (memoryChunk !== true) return cb(null, memoryChunk)

    // Chunk in store
    this.db.transaction('r', this.db.chunks, async () => {
      const result = await this.db.chunks.get({ id: index })
      if (result === undefined) return cb(null, Buffer.alloc(0))

      const buf = result.buf
      if (!opts) return this.nextTick(cb, null, buf)

      const offset = opts.offset || 0
      const len = opts.length || (buf.length - offset)
      return cb(null, buf.slice(offset, len + offset))
    })
    .catch(err => {
      console.error(err)
      return cb(err)
    })
  }

  close (cb: (err?: Error) => void) {
    return this.destroy(cb)
  }

  async destroy (cb: (err?: Error) => void) {
    try {
      if (this.pendingPut) {
        clearTimeout(this.putBulkTimeout)
        this.pendingPut = null
      }
      if (this.cleanerInterval) {
        clearInterval(this.cleanerInterval)
        this.cleanerInterval = null
      }

      if (this.db) {
        this.db.close()

        await this.dropDatabase(this.databaseName)
      }

      if (this.expirationDB) {
        this.expirationDB.close()
        this.expirationDB = null
      }

      return cb()
    } catch (err) {
      console.error('Cannot destroy peertube chunk store.', err)
      return cb(err)
    }
  }

  private runCleaner () {
    this.checkExpiration()

    this.cleanerInterval = setInterval(async () => {
      this.checkExpiration()
    }, PeertubeChunkStore.CLEANER_INTERVAL_MS)
  }

  private async checkExpiration () {
    let databasesToDeleteInfo: { name: string }[] = []

    try {
      await this.expirationDB.transaction('rw', this.expirationDB.databases, async () => {
        // Update our database expiration since we are alive
        await this.expirationDB.databases.put({
          name: this.databaseName,
          expiration: new Date().getTime() + PeertubeChunkStore.CLEANER_EXPIRATION_MS
        })

        const now = new Date().getTime()
        databasesToDeleteInfo = await this.expirationDB.databases.where('expiration').below(now).toArray()
      })
    } catch (err) {
      console.error('Cannot update expiration of fetch expired databases.', err)
    }

    for (const databaseToDeleteInfo of databasesToDeleteInfo) {
      await this.dropDatabase(databaseToDeleteInfo.name)
    }
  }

  private async dropDatabase (databaseName: string) {
    const dbToDelete = new ChunkDatabase(databaseName)
    console.log('Destroying IndexDB database %s.', databaseName)

    try {
      await dbToDelete.delete()

      await this.expirationDB.transaction('rw', this.expirationDB.databases, () => {
        return this.expirationDB.databases.where({ name: databaseName }).delete()
      })
    } catch (err) {
      console.error('Cannot delete %s.', databaseName, err)
    }
  }

  private nextTick <T> (cb: (err?: Error, val?: T) => void, err: Error, val?: T) {
    process.nextTick(() => cb(err, val), undefined)
  }
}
