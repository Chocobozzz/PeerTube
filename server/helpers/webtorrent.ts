import { logger } from './logger'
import { generateVideoTmpPath } from './utils'
import * as WebTorrent from 'webtorrent'
import { createWriteStream, remove } from 'fs-extra'
import { CONFIG } from '../initializers'
import { join } from 'path'

function downloadWebTorrentVideo (target: { magnetUri: string, torrentName?: string }, timeout?: number) {
  const id = target.magnetUri || target.torrentName
  let timer

  const path = generateVideoTmpPath(id)
  logger.info('Importing torrent video %s', id)

  return new Promise<string>((res, rej) => {
    const webtorrent = new WebTorrent()
    let file: WebTorrent.TorrentFile

    const torrentId = target.magnetUri || join(CONFIG.STORAGE.TORRENTS_DIR, target.torrentName)

    const options = { path: CONFIG.STORAGE.VIDEOS_DIR }
    const torrent = webtorrent.add(torrentId, options, torrent => {
      if (torrent.files.length !== 1) {
        if (timer) clearTimeout(timer)

        return safeWebtorrentDestroy(webtorrent, torrentId, file.name, target.torrentName)
          .then(() => rej(new Error('Cannot import torrent ' + torrentId + ': there are multiple files in it')))
      }

      file = torrent.files[ 0 ]

      const writeStream = createWriteStream(path)
      writeStream.on('finish', () => {
        if (timer) clearTimeout(timer)

        return safeWebtorrentDestroy(webtorrent, torrentId, file.name, target.torrentName)
          .then(() => res(path))
      })

      file.createReadStream().pipe(writeStream)
    })

    torrent.on('error', err => rej(err))

    if (timeout) {
      timer = setTimeout(async () => {
        return safeWebtorrentDestroy(webtorrent, torrentId, file ? file.name : undefined, target.torrentName)
          .then(() => rej(new Error('Webtorrent download timeout.')))
      }, timeout)
    }
  })
}

// ---------------------------------------------------------------------------

export {
  downloadWebTorrentVideo
}

// ---------------------------------------------------------------------------

function safeWebtorrentDestroy (webtorrent: WebTorrent.Instance, torrentId: string, filename?: string, torrentName?: string) {
  return new Promise(res => {
    webtorrent.destroy(err => {
      // Delete torrent file
      if (torrentName) {
        remove(torrentId)
          .catch(err => logger.error('Cannot remove torrent %s in webtorrent download.', torrentId, { err }))
      }

      // Delete downloaded file
      if (filename) {
        remove(join(CONFIG.STORAGE.VIDEOS_DIR, filename))
          .catch(err => logger.error('Cannot remove torrent file %s in webtorrent download.', filename, { err }))
      }

      if (err) {
        logger.warn('Cannot destroy webtorrent in timeout.', { err })
      }

      return res()
    })
  })
}
