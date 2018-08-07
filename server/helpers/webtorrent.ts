import { logger } from './logger'
import { generateVideoTmpPath } from './utils'
import * as WebTorrent from 'webtorrent'
import { createWriteStream } from 'fs'
import { Instance as ParseTorrent } from 'parse-torrent'
import { CONFIG } from '../initializers'
import { join } from 'path'

function downloadWebTorrentVideo (target: { magnetUri: string, torrentName: string }) {
  const id = target.magnetUri || target.torrentName

  const path = generateVideoTmpPath(id)
  logger.info('Importing torrent video %s', id)

  return new Promise<string>((res, rej) => {
    const webtorrent = new WebTorrent()

    const torrentId = target.magnetUri || join(CONFIG.STORAGE.TORRENTS_DIR, target.torrentName)
    const torrent = webtorrent.add(torrentId, torrent => {
      if (torrent.files.length !== 1) return rej(new Error('The number of files is not equal to 1 for ' + torrentId))

      const file = torrent.files[ 0 ]
      file.createReadStream().pipe(createWriteStream(path))
    })

    torrent.on('done', () => res(path))

    torrent.on('error', err => rej(err))
  })
}

// ---------------------------------------------------------------------------

export {
  downloadWebTorrentVideo
}
