import { logger } from './logger'
import { generateVideoImportTmpPath } from './utils'
import * as WebTorrent from 'webtorrent'
import { createWriteStream, ensureDir, remove, writeFile } from 'fs-extra'
import { CONFIG } from '../initializers/config'
import { dirname, join } from 'path'
import * as createTorrent from 'create-torrent'
import { promisify2 } from './core-utils'
import { MVideo } from '@server/typings/models/video/video'
import { MVideoFile, MVideoFileRedundanciesOpt } from '@server/typings/models/video/video-file'
import { isStreamingPlaylist, MStreamingPlaylistVideo } from '@server/typings/models/video/video-streaming-playlist'
import { STATIC_PATHS, WEBSERVER } from '@server/initializers/constants'
import * as parseTorrent from 'parse-torrent'
import * as magnetUtil from 'magnet-uri'
import { isArray } from '@server/helpers/custom-validators/misc'
import { extractVideo } from '@server/lib/videos'
import { getTorrentFileName, getVideoFilename, getVideoFilePath } from '@server/lib/video-paths'

const createTorrentPromise = promisify2<string, any, any>(createTorrent)

async function downloadWebTorrentVideo (target: { magnetUri: string, torrentName?: string }, timeout: number) {
  const id = target.magnetUri || target.torrentName
  let timer

  const path = generateVideoImportTmpPath(id)
  logger.info('Importing torrent video %s', id)

  const directoryPath = join(CONFIG.STORAGE.TMP_DIR, 'webtorrent')
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

async function createTorrentAndSetInfoHash (videoOrPlaylist: MVideo | MStreamingPlaylistVideo, videoFile: MVideoFile) {
  const video = extractVideo(videoOrPlaylist)
  const { baseUrlHttp } = video.getBaseUrls()

  const options = {
    // Keep the extname, it's used by the client to stream the file inside a web browser
    name: `${video.name} ${videoFile.resolution}p${videoFile.extname}`,
    createdBy: 'PeerTube',
    announceList: [
      [ WEBSERVER.WS + '://' + WEBSERVER.HOSTNAME + ':' + WEBSERVER.PORT + '/tracker/socket' ],
      [ WEBSERVER.URL + '/tracker/announce' ]
    ],
    urlList: [ videoOrPlaylist.getVideoFileUrl(videoFile, baseUrlHttp) ]
  }

  const torrent = await createTorrentPromise(getVideoFilePath(videoOrPlaylist, videoFile), options)

  const filePath = join(CONFIG.STORAGE.TORRENTS_DIR, getTorrentFileName(videoOrPlaylist, videoFile))
  logger.info('Creating torrent %s.', filePath)

  await writeFile(filePath, torrent)

  const parsedTorrent = parseTorrent(torrent)
  videoFile.infoHash = parsedTorrent.infoHash
}

function generateMagnetUri (
  videoOrPlaylist: MVideo | MStreamingPlaylistVideo,
  videoFile: MVideoFileRedundanciesOpt,
  baseUrlHttp: string,
  baseUrlWs: string
) {
  const video = isStreamingPlaylist(videoOrPlaylist)
    ? videoOrPlaylist.Video
    : videoOrPlaylist

  const xs = videoOrPlaylist.getTorrentUrl(videoFile, baseUrlHttp)
  const announce = videoOrPlaylist.getTrackerUrls(baseUrlHttp, baseUrlWs)
  let urlList = [ videoOrPlaylist.getVideoFileUrl(videoFile, baseUrlHttp) ]

  const redundancies = videoFile.RedundancyVideos
  if (isArray(redundancies)) urlList = urlList.concat(redundancies.map(r => r.fileUrl))

  const magnetHash = {
    xs,
    announce,
    urlList,
    infoHash: videoFile.infoHash,
    name: video.name
  }

  return magnetUtil.encode(magnetHash)
}

// ---------------------------------------------------------------------------

export {
  createTorrentPromise,
  createTorrentAndSetInfoHash,
  generateMagnetUri,
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
