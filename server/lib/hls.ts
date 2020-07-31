import { basename, dirname, join } from 'path'
import { HLS_STREAMING_PLAYLIST_DIRECTORY, P2P_MEDIA_LOADER_PEER_VERSION } from '../initializers/constants'
import { close, ensureDir, move, open, outputJSON, pathExists, read, readFile, remove, writeFile } from 'fs-extra'
import { getVideoStreamSize, getAudioStreamCodec, getVideoStreamCodec } from '../helpers/ffmpeg-utils'
import { sha256 } from '../helpers/core-utils'
import { VideoStreamingPlaylistModel } from '../models/video/video-streaming-playlist'
import { logger } from '../helpers/logger'
import { doRequest, doRequestAndSaveToFile } from '../helpers/requests'
import { generateRandomString } from '../helpers/utils'
import { flatten, uniq } from 'lodash'
import { VideoFileModel } from '../models/video/video-file'
import { CONFIG } from '../initializers/config'
import { sequelizeTypescript } from '../initializers/database'
import { MVideoWithFile } from '@server/types/models'
import { getVideoFilename, getVideoFilePath } from './video-paths'

async function updateStreamingPlaylistsInfohashesIfNeeded () {
  const playlistsToUpdate = await VideoStreamingPlaylistModel.listByIncorrectPeerVersion()

  // Use separate SQL queries, because we could have many videos to update
  for (const playlist of playlistsToUpdate) {
    await sequelizeTypescript.transaction(async t => {
      const videoFiles = await VideoFileModel.listByStreamingPlaylist(playlist.id, t)

      playlist.p2pMediaLoaderInfohashes = VideoStreamingPlaylistModel.buildP2PMediaLoaderInfoHashes(playlist.playlistUrl, videoFiles)
      playlist.p2pMediaLoaderPeerVersion = P2P_MEDIA_LOADER_PEER_VERSION
      await playlist.save({ transaction: t })
    })
  }
}

async function updateMasterHLSPlaylist (video: MVideoWithFile) {
  const directory = join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid)
  const masterPlaylists: string[] = [ '#EXTM3U', '#EXT-X-VERSION:3' ]
  const masterPlaylistPath = join(directory, VideoStreamingPlaylistModel.getMasterHlsPlaylistFilename())
  const streamingPlaylist = video.getHLSPlaylist()

  for (const file of streamingPlaylist.VideoFiles) {
    // If we did not generated a playlist for this resolution, skip
    const filePlaylistPath = join(directory, VideoStreamingPlaylistModel.getHlsPlaylistFilename(file.resolution))
    if (await pathExists(filePlaylistPath) === false) continue

    const videoFilePath = getVideoFilePath(streamingPlaylist, file)

    const size = await getVideoStreamSize(videoFilePath)

    const bandwidth = 'BANDWIDTH=' + video.getBandwidthBits(file)
    const resolution = `RESOLUTION=${size.width}x${size.height}`

    let line = `#EXT-X-STREAM-INF:${bandwidth},${resolution}`
    if (file.fps) line += ',FRAME-RATE=' + file.fps

    const videoCodec = await getVideoStreamCodec(videoFilePath)
    line += `,CODECS="${videoCodec}`

    const audioCodec = await getAudioStreamCodec(videoFilePath)
    if (audioCodec) line += `,${audioCodec}`

    line += '"'

    masterPlaylists.push(line)
    masterPlaylists.push(VideoStreamingPlaylistModel.getHlsPlaylistFilename(file.resolution))
  }

  await writeFile(masterPlaylistPath, masterPlaylists.join('\n') + '\n')
}

async function updateSha256Segments (video: MVideoWithFile) {
  const json: { [filename: string]: { [range: string]: string } } = {}

  const playlistDirectory = join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid)
  const hlsPlaylist = video.getHLSPlaylist()

  // For all the resolutions available for this video
  for (const file of hlsPlaylist.VideoFiles) {
    const rangeHashes: { [range: string]: string } = {}

    const videoPath = getVideoFilePath(hlsPlaylist, file)
    const playlistPath = join(playlistDirectory, VideoStreamingPlaylistModel.getHlsPlaylistFilename(file.resolution))

    // Maybe the playlist is not generated for this resolution yet
    if (!await pathExists(playlistPath)) continue

    const playlistContent = await readFile(playlistPath)
    const ranges = getRangesFromPlaylist(playlistContent.toString())

    const fd = await open(videoPath, 'r')
    for (const range of ranges) {
      const buf = Buffer.alloc(range.length)
      await read(fd, buf, 0, range.length, range.offset)

      rangeHashes[`${range.offset}-${range.offset + range.length - 1}`] = sha256(buf)
    }
    await close(fd)

    const videoFilename = getVideoFilename(hlsPlaylist, file)
    json[videoFilename] = rangeHashes
  }

  const outputPath = join(playlistDirectory, VideoStreamingPlaylistModel.getHlsSha256SegmentsFilename())
  await outputJSON(outputPath, json)
}

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

function downloadPlaylistSegments (playlistUrl: string, destinationDir: string, timeout: number) {
  let timer

  logger.info('Importing HLS playlist %s', playlistUrl)

  return new Promise<string>(async (res, rej) => {
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

        const bodyKBLimit = 10 * 1000 * 1000 // 10GB
        await doRequestAndSaveToFile({ uri: fileUrl }, destPath, bodyKBLimit)
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
    const { body } = await doRequest<string>({ uri: playlistUrl })

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
  updateSha256Segments,
  downloadPlaylistSegments,
  updateStreamingPlaylistsInfohashesIfNeeded
}

// ---------------------------------------------------------------------------
