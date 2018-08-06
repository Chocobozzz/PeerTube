import { logger } from './logger'
import { generateVideoTmpPath } from './utils'
import * as WebTorrent from 'webtorrent'
import { createWriteStream } from 'fs'

function downloadWebTorrentVideo (target: string) {
  const path = generateVideoTmpPath(target)

  logger.info('Importing torrent video %s', target)

  return new Promise<string>((res, rej) => {
    const webtorrent = new WebTorrent()

    const torrent = webtorrent.add(target, torrent => {
      if (torrent.files.length !== 1) throw new Error('The number of files is not equal to 1 for ' + target)

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
