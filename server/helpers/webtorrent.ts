import { logger } from './logger'
import { generateVideoTmpPath } from './utils'
import * as WebTorrent from 'webtorrent'
import { createWriteStream, ensureDir, remove } from 'fs-extra'
import { CONFIG } from '../initializers'
import { dirname, join } from 'path'

async function downloadWebTorrentVideo (target: { magnetUri: string, torrentName?: string }, timeout: number) {
  const id = target.magnetUri || target.torrentName
  let timer

  const path = generateVideoTmpPath(id)
  logger.info('Importing torrent video %s', id)

  const directoryPath = join(CONFIG.STORAGE.VIDEOS_DIR, 'import')
  await ensureDir(directoryPath)

  return new Promise<string>((res, rej) => {
    const webtorrent = new WebTorrent()
    let file: WebTorrent.TorrentFile

    const torrentId = target.magnetUri || join(CONFIG.STORAGE.TORRENTS_DIR, target.torrentName)

    const options = { path: directoryPath }
    const torrent = webtorrent.add(torrentId, options, torrent => {
      if (torrent.files.length !== 1) {
        if (timer) clearTimeout(timer)

        for (let file of torrent.files) {
          deleteDownloadedFile({ directoryPath, filepath: file.path })
        }

        return safeWebtorrentDestroy(webtorrent, torrentId, undefined, target.torrentName)
          .then(() => rej(new Error('Cannot import torrent ' + torrentId + ': there are multiple files in it')))
      }

      file = torrent.files[ 0 ]

      // FIXME: avoid creating another stream when https://github.com/webtorrent/webtorrent/issues/1517 is fixed
      const writeStream = createWriteStream(path)
      writeStream.on('finish', () => {
        if (timer) clearTimeout(timer)

        return safeWebtorrentDestroy(webtorrent, torrentId, { directoryPath, filepath: file.path }, target.torrentName)
          .then(() => res(path))
      })

      file.createReadStream().pipe(writeStream)
    })

    torrent.on('error', err => rej(err))

    timer = setTimeout(async () => {
      return safeWebtorrentDestroy(webtorrent, torrentId, file ? { directoryPath, filepath: file.path } : undefined, target.torrentName)
        .then(() => rej(new Error('Webtorrent download timeout.')))
    }, timeout)
  })
}

// ---------------------------------------------------------------------------

export {
  downloadWebTorrentVideo
}

// ---------------------------------------------------------------------------

function safeWebtorrentDestroy (
  webtorrent: WebTorrent.Instance,
  torrentId: string,
  downloadedFile?: { directoryPath: string, filepath: string },
  torrentName?: string
) {
  return new Promise(res => {
    webtorrent.destroy(err => {
      // Delete torrent file
      if (torrentName) {
        logger.debug('Removing %s torrent after webtorrent download.', torrentId)
        remove(torrentId)
          .catch(err => logger.error('Cannot remove torrent %s in webtorrent download.', torrentId, { err }))
      }

      // Delete downloaded file
      if (downloadedFile) deleteDownloadedFile(downloadedFile)

      if (err) logger.warn('Cannot destroy webtorrent in timeout.', { err })

      return res()
    })
  })
}

function deleteDownloadedFile (downloadedFile: { directoryPath: string, filepath: string }) {
  // We want to delete the base directory
  let pathToDelete = dirname(downloadedFile.filepath)
  if (pathToDelete === '.') pathToDelete = downloadedFile.filepath

  const toRemovePath = join(downloadedFile.directoryPath, pathToDelete)

  logger.debug('Removing %s after webtorrent download.', toRemovePath)
  remove(toRemovePath)
    .catch(err => logger.error('Cannot remove torrent file %s in webtorrent download.', toRemovePath, { err }))
}
