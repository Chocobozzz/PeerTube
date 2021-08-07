import { close, ensureDir, move, open, outputJSON, pathExists, read, readFile, remove, stat, writeFile } from 'fs-extra'
import { flatten, uniq } from 'lodash'
import { basename, dirname, join } from 'path'
import { MStreamingPlaylistFilesVideo, MVideoWithFile } from '@server/types/models'
import { sha256 } from '../helpers/core-utils'
import { getAudioStreamCodec, getVideoStreamCodec, getVideoStreamSize } from '../helpers/ffprobe-utils'
import { logger } from '../helpers/logger'
import { doRequest, doRequestAndSaveToFile } from '../helpers/requests'
import { generateRandomString } from '../helpers/utils'
import { CONFIG } from '../initializers/config'
import { HLS_STREAMING_PLAYLIST_DIRECTORY, P2P_MEDIA_LOADER_PEER_VERSION } from '../initializers/constants'
import { sequelizeTypescript } from '../initializers/database'
import { VideoFileModel } from '../models/video/video-file'
import { VideoStreamingPlaylistModel } from '../models/video/video-streaming-playlist'
import { getHlsResolutionPlaylistFilename, getVideoFilePath } from './video-paths'

async function updateStreamingPlaylistsInfohashesIfNeeded () {
  const playlistsToUpdate = await VideoStreamingPlaylistModel.listByIncorrectPeerVersion()

  // Use separate SQL queries, because we could have many videos to update
  for (const playlist of playlistsToUpdate) {
    await sequelizeTypescript.transaction(async t => {
      const videoFiles = await VideoFileModel.listByStreamingPlaylist(playlist.id, t)

      playlist.assignP2PMediaLoaderInfoHashes(playlist.Video, videoFiles)
      playlist.p2pMediaLoaderPeerVersion = P2P_MEDIA_LOADER_PEER_VERSION

      await playlist.save({ transaction: t })
    })
  }
}

async function updateMasterHLSPlaylist (video: MVideoWithFile, playlist: MStreamingPlaylistFilesVideo) {
  const directory = join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid)

  const masterPlaylists: string[] = [ '#EXTM3U', '#EXT-X-VERSION:3' ]

  const masterPlaylistPath = join(directory, playlist.playlistFilename)

  for (const file of playlist.VideoFiles) {
    const playlistFilename = getHlsResolutionPlaylistFilename(file.filename)

    // If we did not generated a playlist for this resolution, skip
    const filePlaylistPath = join(directory, playlistFilename)
    if (await pathExists(filePlaylistPath) === false) continue

    const videoFilePath = getVideoFilePath(playlist, file)

    const size = await getVideoStreamSize(videoFilePath)

    const bandwidth = 'BANDWIDTH=' + video.getBandwidthBits(file)
    const resolution = `RESOLUTION=${size.width}x${size.height}`

    let line = `#EXT-X-STREAM-INF:${bandwidth},${resolution}`
    if (file.fps) line += ',FRAME-RATE=' + file.fps

    const codecs = await Promise.all([
      getVideoStreamCodec(videoFilePath),
      getAudioStreamCodec(videoFilePath)
    ])

    line += `,CODECS="${codecs.filter(c => !!c).join(',')}"`

    masterPlaylists.push(line)
    masterPlaylists.push(playlistFilename)
  }

  await writeFile(masterPlaylistPath, masterPlaylists.join('\n') + '\n')
}

async function updateSha256VODSegments (video: MVideoWithFile, playlist: MStreamingPlaylistFilesVideo) {
  const json: { [filename: string]: { [range: string]: string } } = {}

  const playlistDirectory = join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid)

  // For all the resolutions available for this video
  for (const file of playlist.VideoFiles) {
    const rangeHashes: { [range: string]: string } = {}

    const videoPath = getVideoFilePath(playlist, file)
    const resolutionPlaylistPath = join(playlistDirectory, getHlsResolutionPlaylistFilename(file.filename))

    // Maybe the playlist is not generated for this resolution yet
    if (!await pathExists(resolutionPlaylistPath)) continue

    const playlistContent = await readFile(resolutionPlaylistPath)
    const ranges = getRangesFromPlaylist(playlistContent.toString())

    const fd = await open(videoPath, 'r')
    for (const range of ranges) {
      const buf = Buffer.alloc(range.length)
      await read(fd, buf, 0, range.length, range.offset)

      rangeHashes[`${range.offset}-${range.offset + range.length - 1}`] = sha256(buf)
    }
    await close(fd)

    const videoFilename = file.filename
    json[videoFilename] = rangeHashes
  }

  const outputPath = join(playlistDirectory, playlist.segmentsSha256Filename)
  await outputJSON(outputPath, json)
}

async function buildSha256Segment (segmentPath: string) {
  const buf = await readFile(segmentPath)
  return sha256(buf)
}

function downloadPlaylistSegments (playlistUrl: string, destinationDir: string, timeout: number, bodyKBLimit: number) {
  let timer
  let remainingBodyKBLimit = bodyKBLimit

  logger.info('Importing HLS playlist %s', playlistUrl)

  return new Promise<void>(async (res, rej) => {
    const tmpDirectory = join(CONFIG.STORAGE.TMP_DIR, await generateRandomString(10))

    await ensureDir(tmpDirectory)

    timer = setTimeout(() => {
      deleteTmpDirectory(tmpDirectory)

      return rej(new Error('HLS download timeout.'))
    }, timeout)

    try {
      // Fetch master playlist
      const subPlaylistUrls = await fetchUniqUrls(playlistUrl)

      const subRequests = subPlaylistUrls.map(u => fetchUniqUrls(u))
      const fileUrls = uniq(flatten(await Promise.all(subRequests)))

      logger.debug('Will download %d HLS files.', fileUrls.length, { fileUrls })

      for (const fileUrl of fileUrls) {
        const destPath = join(tmpDirectory, basename(fileUrl))

        await doRequestAndSaveToFile(fileUrl, destPath, { bodyKBLimit: remainingBodyKBLimit })

        const { size } = await stat(destPath)
        remainingBodyKBLimit -= (size / 1000)

        logger.debug('Downloaded HLS playlist file %s with %d kB remained limit.', fileUrl, Math.floor(remainingBodyKBLimit))
      }

      clearTimeout(timer)

      await move(tmpDirectory, destinationDir, { overwrite: true })

      return res()
    } catch (err) {
      deleteTmpDirectory(tmpDirectory)

      return rej(err)
    }
  })

  function deleteTmpDirectory (directory: string) {
    remove(directory)
      .catch(err => logger.error('Cannot delete path on HLS download error.', { err }))
  }

  async function fetchUniqUrls (playlistUrl: string) {
    const { body } = await doRequest(playlistUrl)

    if (!body) return []

    const urls = body.split('\n')
      .filter(line => line.endsWith('.m3u8') || line.endsWith('.mp4'))
      .map(url => {
        if (url.startsWith('http://') || url.startsWith('https://')) return url

        return `${dirname(playlistUrl)}/${url}`
      })

    return uniq(urls)
  }
}

// ---------------------------------------------------------------------------

export {
  updateMasterHLSPlaylist,
  updateSha256VODSegments,
  buildSha256Segment,
  downloadPlaylistSegments,
  updateStreamingPlaylistsInfohashesIfNeeded
}

// ---------------------------------------------------------------------------

function getRangesFromPlaylist (playlistContent: string) {
  const ranges: { offset: number, length: number }[] = []
  const lines = playlistContent.split('\n')
  const regex = /^#EXT-X-BYTERANGE:(\d+)@(\d+)$/

  for (const line of lines) {
    const captured = regex.exec(line)

    if (captured) {
      ranges.push({ length: parseInt(captured[1], 10), offset: parseInt(captured[2], 10) })
    }
  }

  return ranges
}
