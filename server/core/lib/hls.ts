import { sortBy, uniqify, uuidRegex } from '@peertube/peertube-core-utils'
import { ffprobePromise, getVideoStreamDimensionsInfo } from '@peertube/peertube-ffmpeg'
import { FileStorage, VideoResolution } from '@peertube/peertube-models'
import { sha256 } from '@peertube/peertube-node-utils'
import { ApplicationModel } from '@server/models/application/application.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { MStreamingPlaylist, MStreamingPlaylistFilesVideo, MVideo, MVideoCaption } from '@server/types/models/index.js'
import { ensureDir, move, outputJSON, remove } from 'fs-extra/esm'
import { open, readFile, stat, writeFile } from 'fs/promises'
import flatten from 'lodash-es/flatten.js'
import PQueue from 'p-queue'
import { basename, dirname, join } from 'path'
import { getAudioStreamCodec, getVideoStreamCodec } from '../helpers/ffmpeg/index.js'
import { logger, loggerTagsFactory } from '../helpers/logger.js'
import { doRequest, doRequestAndSaveToFile } from '../helpers/requests.js'
import { generateRandomString } from '../helpers/utils.js'
import { CONFIG } from '../initializers/config.js'
import { P2P_MEDIA_LOADER_PEER_VERSION, REQUEST_TIMEOUTS } from '../initializers/constants.js'
import { sequelizeTypescript } from '../initializers/database.js'
import { VideoFileModel } from '../models/video/video-file.js'
import { VideoStreamingPlaylistModel } from '../models/video/video-streaming-playlist.js'
import { storeHLSFileFromContent } from './object-storage/index.js'
import { generateHLSMasterPlaylistFilename, generateHlsSha256SegmentsFilename, getHLSResolutionPlaylistFilename } from './paths.js'
import { VideoPathManager } from './video-path-manager.js'

const lTags = loggerTagsFactory('hls')

export async function updateStreamingPlaylistsInfohashesIfNeeded () {
  let playlistsToUpdateIds = new Set(await VideoStreamingPlaylistModel.listIdsByIncorrectPeerVersion())

  if (playlistsToUpdateIds.size !== 0) {
    logger.info(`Will update ${playlistsToUpdateIds.size} streaming playlists infohash because of protocol version change.`, lTags())
  }

  if (await ApplicationModel.streamingPlaylistBaseUrlChanged()) {
    const localIds = await VideoStreamingPlaylistModel.listIdsLocals()

    if (localIds.length !== 0) {
      logger.info(`Will update ${localIds.length} local streaming playlists infohash because of object storage base URL change.`, lTags())

      playlistsToUpdateIds = new Set([ ...playlistsToUpdateIds, ...localIds ])
    }
  }

  // Use separate SQL queries, because we could have many videos to update
  for (const playlistId of playlistsToUpdateIds) {
    try {
      await sequelizeTypescript.transaction(async t => {
        const playlist = await VideoStreamingPlaylistModel.loadWithVideo(playlistId, t)
        const videoFiles = await VideoFileModel.listByStreamingPlaylist(playlistId, t)

        playlist.assignP2PMediaLoaderInfoHashes(playlist.Video, videoFiles)
        playlist.p2pMediaLoaderPeerVersion = P2P_MEDIA_LOADER_PEER_VERSION

        await playlist.save({ transaction: t })
      })
    } catch (err) {
      logger.error(`Cannot update streaming playlist infohash of playlist id ${playlistId}`, { err })
    }
  }
}

export async function updateM3U8AndShaPlaylist (video: MVideo, playlist: MStreamingPlaylist) {
  try {
    let playlistWithFiles = await updateMasterHLSPlaylist(video, playlist)
    playlistWithFiles = await updateSha256VODSegments(video, playlist)

    // Refresh playlist, operations can take some time
    playlistWithFiles = await VideoStreamingPlaylistModel.loadWithVideoAndFiles(playlist.id)
    playlistWithFiles.assignP2PMediaLoaderInfoHashes(video, playlistWithFiles.VideoFiles)
    await playlistWithFiles.save()

    video.setHLSPlaylist(playlistWithFiles)
  } catch (err) {
    logger.warn('Cannot update playlist after file change. Maybe due to concurrent transcoding', { err })
  }
}

// ---------------------------------------------------------------------------

// Avoid concurrency issues when updating streaming playlist files
const playlistFilesQueue = new PQueue({ concurrency: 1 })

function updateMasterHLSPlaylist (video: MVideo, playlistArg: MStreamingPlaylist): Promise<MStreamingPlaylistFilesVideo> {
  return playlistFilesQueue.add(async () => {
    const playlist = await VideoStreamingPlaylistModel.loadWithVideoAndFiles(playlistArg.id)
    const captions = await VideoCaptionModel.listVideoCaptions(video.id)

    const extMediaAudio: string[] = []
    const extMediaSubtitle: string[] = []
    const extStreamInfo: string[] = []
    let separatedAudioCodec: string

    const splitAudioAndVideo = playlist.hasAudioAndVideoSplitted()

    for (const caption of captions) {
      if (!caption.m3u8Filename) continue

      extMediaSubtitle.push(
        `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subtitles",` +
          `NAME="${VideoCaptionModel.getLanguageLabel(caption.language)}",DEFAULT=NO,AUTOSELECT=NO,FORCED=NO,` +
          `LANGUAGE="${caption.language}",URI="${caption.m3u8Filename}"`
      )
    }

    // Sort to have the audio resolution first (if it exists)
    for (const file of sortBy(playlist.VideoFiles, 'resolution')) {
      const playlistFilename = getHLSResolutionPlaylistFilename(file.filename)

      await VideoPathManager.Instance.makeAvailableVideoFile(file.withVideoOrPlaylist(playlist), async videoFilePath => {
        const probe = await ffprobePromise(videoFilePath)

        if (splitAudioAndVideo && file.resolution === VideoResolution.H_NOVIDEO) {
          separatedAudioCodec = await getAudioStreamCodec(videoFilePath, probe)
        }

        const size = await getVideoStreamDimensionsInfo(videoFilePath, probe)

        const bandwidth = 'BANDWIDTH=' + video.getBandwidthBits(file)
        const resolution = file.resolution === VideoResolution.H_NOVIDEO
          ? ''
          : `,RESOLUTION=${size?.width || 0}x${size?.height || 0}`

        let line = `#EXT-X-STREAM-INF:${bandwidth}${resolution}`
        if (file.fps) line += ',FRAME-RATE=' + file.fps

        const codecs = await Promise.all([
          getVideoStreamCodec(videoFilePath, probe),
          separatedAudioCodec || getAudioStreamCodec(videoFilePath, probe)
        ])

        line += `,CODECS="${codecs.filter(c => !!c).join(',')}"`

        if (splitAudioAndVideo) line += `,AUDIO="audio"`
        if (extMediaSubtitle.length !== 0) line += `,SUBTITLES="subtitles"`

        // Don't include audio only resolution as a regular "video" resolution
        // Some player may use it automatically and so the user would not have a video stream
        // But if it's the only resolution we can treat it as a regular stream
        if (resolution || playlist.VideoFiles.length === 1) {
          extStreamInfo.push(line)
          extStreamInfo.push(playlistFilename)
        } else if (splitAudioAndVideo) {
          extMediaAudio.push(`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Audio",AUTOSELECT=YES,DEFAULT=YES,URI="${playlistFilename}"`)
        }
      })
    }

    const masterPlaylists = [ '#EXTM3U', '#EXT-X-VERSION:3', '', ...extMediaSubtitle, '', ...extMediaAudio, '', ...extStreamInfo ]

    if (playlist.playlistFilename) {
      await video.removeStreamingPlaylistFile(playlist, playlist.playlistFilename)
    }
    playlist.playlistFilename = generateHLSMasterPlaylistFilename(video.isLive)

    const masterPlaylistContent = masterPlaylists.join('\n') + '\n'

    if (playlist.storage === FileStorage.OBJECT_STORAGE) {
      playlist.playlistUrl = await storeHLSFileFromContent({
        playlist,
        pathOrFilename: playlist.playlistFilename,
        content: masterPlaylistContent
      })

      logger.info(`Updated master playlist file of video ${video.uuid} to object storage ${playlist.playlistUrl}`, lTags(video.uuid))
    } else {
      const masterPlaylistPath = VideoPathManager.Instance.getFSHLSOutputPath(video, playlist.playlistFilename)
      await writeFile(masterPlaylistPath, masterPlaylistContent)

      logger.info(`Updated master playlist file ${masterPlaylistPath} of video ${video.uuid}`, lTags(video.uuid))
    }

    return playlist.save()
  })
}

// ---------------------------------------------------------------------------

function updateSha256VODSegments (video: MVideo, playlistArg: MStreamingPlaylist): Promise<MStreamingPlaylistFilesVideo> {
  return playlistFilesQueue.add(async () => {
    const json: { [filename: string]: { [range: string]: string } } = {}

    const playlist = await VideoStreamingPlaylistModel.loadWithVideoAndFiles(playlistArg.id)

    // For all the resolutions available for this video
    for (const file of playlist.VideoFiles) {
      const rangeHashes: { [range: string]: string } = {}
      const fileWithPlaylist = file.withVideoOrPlaylist(playlist)

      await VideoPathManager.Instance.makeAvailableVideoFile(fileWithPlaylist, videoPath => {
        return VideoPathManager.Instance.makeAvailableResolutionPlaylistFile(fileWithPlaylist, async resolutionPlaylistPath => {
          const playlistContent = await readFile(resolutionPlaylistPath)
          const ranges = getRangesFromPlaylist(playlistContent.toString())

          const fd = await open(videoPath, 'r')
          for (const range of ranges) {
            const buf = Buffer.alloc(range.length)
            await fd.read(buf, 0, range.length, range.offset)

            rangeHashes[`${range.offset}-${range.offset + range.length - 1}`] = sha256(buf)
          }
          await fd.close()

          const videoFilename = file.filename
          json[videoFilename] = rangeHashes
        })
      })
    }

    if (playlist.segmentsSha256Filename) {
      await video.removeStreamingPlaylistFile(playlist, playlist.segmentsSha256Filename)
    }
    playlist.segmentsSha256Filename = generateHlsSha256SegmentsFilename(video.isLive)

    if (playlist.storage === FileStorage.OBJECT_STORAGE) {
      playlist.segmentsSha256Url = await storeHLSFileFromContent({
        playlist,
        pathOrFilename: playlist.segmentsSha256Filename,
        content: JSON.stringify(json)
      })
    } else {
      const outputPath = VideoPathManager.Instance.getFSHLSOutputPath(video, playlist.segmentsSha256Filename)
      await outputJSON(outputPath, json)
    }

    return playlist.save()
  })
}

// ---------------------------------------------------------------------------

export async function buildSha256Segment (segmentPath: string) {
  const buf = await readFile(segmentPath)
  return sha256(buf)
}

export function downloadPlaylistSegments (playlistUrl: string, destinationDir: string, timeout: number, bodyKBLimit: number) {
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
      const fileUrls = uniqify(flatten(await Promise.all(subRequests)))

      logger.debug('Will download %d HLS files.', fileUrls.length, { fileUrls })

      for (const fileUrl of fileUrls) {
        const destPath = join(tmpDirectory, basename(fileUrl))

        await doRequestAndSaveToFile(fileUrl, destPath, { bodyKBLimit: remainingBodyKBLimit, timeout: REQUEST_TIMEOUTS.REDUNDANCY })

        const { size } = await stat(destPath)
        remainingBodyKBLimit -= size / 1000

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

    return uniqify(urls)
  }
}

// ---------------------------------------------------------------------------

export async function renameVideoFileInPlaylist (playlistPath: string, newVideoFilename: string) {
  const content = await readFile(playlistPath, 'utf8')

  const newContent = content.replace(new RegExp(`${uuidRegex}-\\d+-fragmented.mp4`, 'g'), newVideoFilename)

  await writeFile(playlistPath, newContent, 'utf8')
}

// ---------------------------------------------------------------------------

export function injectQueryToPlaylistUrls (content: string, queryString: string) {
  return content.replace(/\.(m3u8|ts|mp4)/gm, '.$1?' + queryString)
}

// ---------------------------------------------------------------------------

export function buildCaptionM3U8Content (options: {
  video: MVideo
  caption: MVideoCaption
}) {
  const { video, caption } = options

  return `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:${video.duration}\n#EXT-X-MEDIA-SEQUENCE:0\n` +
    `#EXTINF:${video.duration},\n${caption.getFileUrl(video)}\n#EXT-X-ENDLIST\n`
}

// ---------------------------------------------------------------------------
// Private
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
