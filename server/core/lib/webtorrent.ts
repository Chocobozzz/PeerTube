import { sha1 } from '@peertube/peertube-node-utils'
import { WEBSERVER } from '@server/initializers/constants.js'
import { generateTorrentFileName } from '@server/lib/paths.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { createTorrentFromWorker } from '@server/lib/worker/parent-process.js'
import { VideoInfohashModel } from '@server/models/video/video-infohash.js'
import { MVideoFile, MVideoFileInfoHash } from '@server/types/models/video/video-file.js'
import { MStreamingPlaylistVideo } from '@server/types/models/video/video-streaming-playlist.js'
import { MVideo } from '@server/types/models/video/video.js'
import bencode from 'bencode'
import { createWriteStream } from 'fs'
import { ensureDir, pathExists, remove } from 'fs-extra/esm'
import { readFile, writeFile } from 'fs/promises'
import { encode as magnetUriEncode } from 'magnet-uri'
import parseTorrent from 'parse-torrent'
import { dirname, join } from 'path'
import { pipeline } from 'stream'
import type { Instance, TorrentFile } from 'webtorrent'
import { logger } from '../helpers/logger.js'
import { generateVideoImportTmpPath } from '../helpers/utils.js'
import { extractVideo } from '../helpers/video.js'
import { CONFIG } from '../initializers/config.js'

export async function downloadWebTorrentVideo (target: { uri: string, torrentPath: string | null }, timeout: number) {
  const torrentId = target.uri || target.torrentPath
  let timer

  const path = generateVideoImportTmpPath(torrentId)
  logger.info('Importing torrent video %s', torrentId)

  const directoryPath = join(CONFIG.STORAGE.TMP_DIR, 'webtorrent')
  await ensureDir(directoryPath)

  // oxlint-disable-next-line new-cap
  const webtorrent = new (await import('webtorrent')).default({
    natUpnp: false,
    natPmp: false,
    utp: false,
    lsd: false,
    downloadLimit: 5_000_000,
    uploadLimit: 5_000_000
  } as any)

  return new Promise<string>(async (res, rej) => {
    let file: TorrentFile

    let torrentInput: string | Buffer

    try {
      torrentInput = target.uri || await readFile(torrentId)
    } catch (err) {
      return rej(new Error('Cannot read torrent file ' + torrentId + ': ' + (err as Error).message))
    }

    const options = { path: directoryPath }
    const torrent = webtorrent.add(torrentInput, options, torrent => {
      if (torrent.files.length !== 1) {
        if (timer) clearTimeout(timer)

        for (const file of torrent.files) {
          deleteDownloadedFile({ directoryPath, filepath: file.path })
        }

        return safeWebtorrentDestroy({ webtorrent, downloadedFile: null, torrentPath: target.torrentPath })
          .then(() => rej(new Error('Cannot import torrent ' + torrentId + ': there are multiple files in it')))
      }

      logger.debug('Got torrent from webtorrent %s.', torrentId, { infoHash: torrent.infoHash })

      file = torrent.files[0]

      // FIXME: avoid creating another stream when https://github.com/webtorrent/webtorrent/issues/1517 is fixed
      const writeStream = createWriteStream(path)
      writeStream.on('finish', () => {
        if (timer) clearTimeout(timer)

        safeWebtorrentDestroy({ webtorrent, downloadedFile: { directoryPath, filepath: file.path }, torrentPath: target.torrentPath })
          .catch(err => logger.error('Cannot destroy webtorrent.', { err }))
          .finally(() => res(path))
      })

      pipeline(
        file.createReadStream(),
        writeStream,
        err => {
          if (err) rej(err)
        }
      )
    })

    torrent.on('error', err => {
      safeWebtorrentDestroy({
        webtorrent,
        downloadedFile: file ? { directoryPath, filepath: file.path } : null,
        torrentPath: target.torrentPath
      }).catch(err => logger.error('Cannot destroy webtorrent.', { err }))
        .finally(() => rej(err))
    })

    timer = setTimeout(() => {
      const err = new Error('Webtorrent download timeout.')

      safeWebtorrentDestroy({
        webtorrent,
        downloadedFile: file
          ? { directoryPath, filepath: file.path }
          : null,
        torrentPath: target.torrentPath
      }).catch(destroyErr => logger.error('Cannot destroy webtorrent.', { err: destroyErr }))
        .finally(() => rej(err))
    }, timeout)
  })
}

export function createTorrentForFile (videoOrPlaylist: MVideo | MStreamingPlaylistVideo, videoFile: MVideoFile) {
  return VideoPathManager.Instance.makeAvailableVideoFile(videoFile.withVideoOrPlaylist(videoOrPlaylist), videoPath => {
    return createTorrentForFileFromPath(videoOrPlaylist, videoFile, videoPath)
  })
}

export async function createTorrentForFileFromPath (
  videoOrPlaylist: MVideo | MStreamingPlaylistVideo,
  videoFile: MVideoFile,
  filePath: string
) {
  const video = extractVideo(videoOrPlaylist)

  const torrentContent = await createTorrentFromWorker({
    path: filePath,

    // Keep the extname, it's used by the client to stream the file inside a web browser
    name: buildInfoName(video, videoFile),
    createdBy: 'PeerTube',
    announceList: buildAnnounceList(),
    urlList: buildUrlList(video, videoFile)
  })

  const torrentFilename = generateTorrentFileName(videoOrPlaylist, videoFile.resolution)
  const torrentPath = join(CONFIG.STORAGE.TORRENTS_DIR, torrentFilename)
  logger.info('Creating torrent %s.', torrentPath)

  await writeFile(torrentPath, torrentContent)

  // Remove old torrent file if it existed
  if (videoFile.hasTorrent()) {
    await remove(join(CONFIG.STORAGE.TORRENTS_DIR, videoFile.torrentFilename))
  }

  // FIXME: typings: parseTorrent now returns an async result
  const parsedTorrent = await (parseTorrent(torrentContent) as unknown as Promise<parseTorrent.Instance>)

  return {
    infoHash: parsedTorrent.infoHash,
    torrentFilename: torrentFilename
  }
}

export async function updateTorrentForFileAndSave (videoOrPlaylist: MVideo | MStreamingPlaylistVideo, videoFile: MVideoFile) {
  const video = extractVideo(videoOrPlaylist)

  if (!videoFile.torrentFilename) {
    logger.error(`Video file ${videoFile.filename} of video ${video.uuid} doesn't have a torrent file, skipping torrent metadata update`)
    return
  }

  const oldTorrentPath = join(CONFIG.STORAGE.TORRENTS_DIR, videoFile.torrentFilename)

  if (!await pathExists(oldTorrentPath)) {
    logger.info('Do not update torrent metadata %s of video %s because the file does not exist anymore.', video.uuid, oldTorrentPath)
    return
  }

  const torrentContent = await readFile(oldTorrentPath)
  const decoded = bencode.decode(torrentContent)

  decoded['announce-list'] = buildAnnounceList()
  decoded.announce = decoded['announce-list'][0][0]

  decoded['url-list'] = buildUrlList(video, videoFile)

  decoded.info.name = buildInfoName(video, videoFile)
  decoded['creation date'] = Math.ceil(Date.now() / 1000)

  const newTorrentFilename = generateTorrentFileName(videoOrPlaylist, videoFile.resolution)
  const newTorrentPath = join(CONFIG.STORAGE.TORRENTS_DIR, newTorrentFilename)

  logger.info('Updating torrent metadata %s -> %s.', oldTorrentPath, newTorrentPath)

  await writeFile(newTorrentPath, bencode.encode(decoded))
  await remove(oldTorrentPath)

  videoFile.torrentFilename = newTorrentFilename

  await VideoInfohashModel.replaceFileInfohash(videoFile.id, sha1(bencode.encode(decoded.info)))

  await videoFile.save()
}

export function generateMagnetUri (
  video: MVideo,
  videoFile: MVideoFileInfoHash,
  trackerUrls: string[]
) {
  const xs = videoFile.getTorrentUrl()
  const announce = trackerUrls

  const urlList = video.hasPrivateStaticPath()
    ? []
    : [ videoFile.getFileUrl(video) ]

  const magnetHash = {
    xs,
    announce,
    urlList,
    infoHash: videoFile.InfoHash.toHexInfohash(),
    name: video.name
  }

  return magnetUriEncode(magnetHash)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function safeWebtorrentDestroy (options: {
  webtorrent: Instance
  downloadedFile: { directoryPath: string, filepath: string } | null
  torrentPath: string | null
}) {
  const { webtorrent, downloadedFile, torrentPath } = options

  return new Promise<void>(res => {
    webtorrent.destroy(err => {
      // Delete torrent file
      if (torrentPath) {
        logger.debug('Removing %s torrent after webtorrent download.', torrentPath)

        remove(torrentPath)
          .catch(err => logger.error('Cannot remove torrent %s in webtorrent download.', torrentPath, { err }))
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

function buildAnnounceList () {
  return [
    [ WEBSERVER.WS + '://' + WEBSERVER.HOSTNAME + ':' + WEBSERVER.PORT + '/tracker/socket' ],
    [ WEBSERVER.URL + '/tracker/announce' ]
  ]
}

function buildUrlList (video: MVideo, videoFile: MVideoFile) {
  if (video.hasPrivateStaticPath()) return []

  return [ videoFile.getFileUrl(video) ]
}

function buildInfoName (video: MVideo, videoFile: MVideoFile) {
  const videoName = video.name.replace(/[/\\?%*:|"<>]/g, '-')

  return `${videoName} ${videoFile.resolution}p${videoFile.extname}`
}
