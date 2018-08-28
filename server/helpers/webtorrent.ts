import { logger } from './logger'
import { generateVideoTmpPath } from './utils'
import * as WebTorrent from 'webtorrent'
import { createWriteStream, remove } from 'fs-extra'
import { CONFIG } from '../initializers'
import { join } from 'path'

function downloadWebTorrentVideo (target: { magnetUri: string, torrentName: string }) {
  const id = target.magnetUri || target.torrentName

  const path = generateVideoTmpPath(id)
  logger.info('Importing torrent video %s', id)

  return new Promise<string>((res, rej) => {
    const webtorrent = new WebTorrent()

    const torrentId = target.magnetUri || join(CONFIG.STORAGE.TORRENTS_DIR, target.torrentName)

    const options = { path: CONFIG.STORAGE.VIDEOS_DIR }
    const torrent = webtorrent.add(torrentId, options, torrent => {
      if (torrent.files.length !== 1) return rej(new Error('The number of files is not equal to 1 for ' + torrentId))

      const file = torrent.files[ 0 ]

      const writeStream = createWriteStream(path)
      writeStream.on('finish', () => {
        webtorrent.destroy(async err => {
          if (err) return rej(err)

          if (target.torrentName) {
            remove(torrentId)
              .catch(err => logger.error('Cannot remove torrent %s in webtorrent download.', torrentId, { err }))
          }

          remove(join(CONFIG.STORAGE.VIDEOS_DIR, file.name))
            .catch(err => logger.error('Cannot remove torrent file %s in webtorrent download.', file.name, { err }))

          res(path)
        })
      })

      file.createReadStream().pipe(writeStream)
    })

    torrent.on('error', err => rej(err))
  })
}

// ---------------------------------------------------------------------------

export {
  downloadWebTorrentVideo
}
