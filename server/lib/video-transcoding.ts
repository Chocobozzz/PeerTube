import { Job } from 'bull'
import { copyFile, ensureDir, move, remove, stat } from 'fs-extra'
import { basename, extname as extnameUtil, join } from 'path'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { MStreamingPlaylistFilesVideo, MVideoFile, MVideoWithAllFiles, MVideoWithFile } from '@server/types/models'
import { VideoResolution } from '../../shared/models/videos'
import { VideoStreamingPlaylistType } from '../../shared/models/videos/video-streaming-playlist.type'
import { transcode, TranscodeOptions, TranscodeOptionsType } from '../helpers/ffmpeg-utils'
import { canDoQuickTranscode, getDurationFromVideoFile, getMetadataFromFile, getVideoFileFPS } from '../helpers/ffprobe-utils'
import { logger } from '../helpers/logger'
import { CONFIG } from '../initializers/config'
import { HLS_STREAMING_PLAYLIST_DIRECTORY, P2P_MEDIA_LOADER_PEER_VERSION, WEBSERVER } from '../initializers/constants'
import { VideoFileModel } from '../models/video/video-file'
import { VideoStreamingPlaylistModel } from '../models/video/video-streaming-playlist'
import { updateMasterHLSPlaylist, updateSha256VODSegments } from './hls'
import { generateVideoStreamingPlaylistName, getVideoFilename, getVideoFilePath } from './video-paths'
import { VideoTranscodingProfilesManager } from './video-transcoding-profiles'

/**
 *
 * Functions that run transcoding functions, update the database, cleanup files, create torrent files...
 * Mainly called by the job queue
 *
 */

// Optimize the original video file and replace it. The resolution is not changed.
async function optimizeOriginalVideofile (video: MVideoWithFile, inputVideoFile: MVideoFile, job?: Job) {
  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR
  const newExtname = '.mp4'

  const videoInputPath = getVideoFilePath(video, inputVideoFile)
  const videoTranscodedPath = join(transcodeDirectory, video.id + '-transcoded' + newExtname)

  const transcodeType: TranscodeOptionsType = await canDoQuickTranscode(videoInputPath)
    ? 'quick-transcode'
    : 'video'

  const transcodeOptions: TranscodeOptions = {
    type: transcodeType,

    inputPath: videoInputPath,
    outputPath: videoTranscodedPath,

    availableEncoders: VideoTranscodingProfilesManager.Instance.getAvailableEncoders(),
    profile: CONFIG.TRANSCODING.PROFILE,

    resolution: inputVideoFile.resolution,

    job
  }

  // Could be very long!
  await transcode(transcodeOptions)

  try {
    await remove(videoInputPath)

    // Important to do this before getVideoFilename() to take in account the new file extension
    inputVideoFile.extname = newExtname

    const videoOutputPath = getVideoFilePath(video, inputVideoFile)

    await onWebTorrentVideoFileTranscoding(video, inputVideoFile, videoTranscodedPath, videoOutputPath)

    return transcodeType
  } catch (err) {
    // Auto destruction...
    video.destroy().catch(err => logger.error('Cannot destruct video after transcoding failure.', { err }))

    throw err
  }
}

// Transcode the original video file to a lower resolution.
async function transcodeNewWebTorrentResolution (video: MVideoWithFile, resolution: VideoResolution, isPortrait: boolean, job: Job) {
  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR
  const extname = '.mp4'

  // We are sure it's x264 in mp4 because optimizeOriginalVideofile was already executed
  const videoInputPath = getVideoFilePath(video, video.getMaxQualityFile())

  const newVideoFile = new VideoFileModel({
    resolution,
    extname,
    size: 0,
    videoId: video.id
  })
  const videoOutputPath = getVideoFilePath(video, newVideoFile)
  const videoTranscodedPath = join(transcodeDirectory, getVideoFilename(video, newVideoFile))

  const transcodeOptions = resolution === VideoResolution.H_NOVIDEO
    ? {
      type: 'only-audio' as 'only-audio',

      inputPath: videoInputPath,
      outputPath: videoTranscodedPath,

      availableEncoders: VideoTranscodingProfilesManager.Instance.getAvailableEncoders(),
      profile: CONFIG.TRANSCODING.PROFILE,

      resolution,

      job
    }
    : {
      type: 'video' as 'video',
      inputPath: videoInputPath,
      outputPath: videoTranscodedPath,

      availableEncoders: VideoTranscodingProfilesManager.Instance.getAvailableEncoders(),
      profile: CONFIG.TRANSCODING.PROFILE,

      resolution,
      isPortraitMode: isPortrait,

      job
    }

  await transcode(transcodeOptions)

  return onWebTorrentVideoFileTranscoding(video, newVideoFile, videoTranscodedPath, videoOutputPath)
}

// Merge an image with an audio file to create a video
async function mergeAudioVideofile (video: MVideoWithAllFiles, resolution: VideoResolution, job: Job) {
  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR
  const newExtname = '.mp4'

  const inputVideoFile = video.getMinQualityFile()

  const audioInputPath = getVideoFilePath(video, inputVideoFile)
  const videoTranscodedPath = join(transcodeDirectory, video.id + '-transcoded' + newExtname)

  // If the user updates the video preview during transcoding
  const previewPath = video.getPreview().getPath()
  const tmpPreviewPath = join(CONFIG.STORAGE.TMP_DIR, basename(previewPath))
  await copyFile(previewPath, tmpPreviewPath)

  const transcodeOptions = {
    type: 'merge-audio' as 'merge-audio',

    inputPath: tmpPreviewPath,
    outputPath: videoTranscodedPath,

    availableEncoders: VideoTranscodingProfilesManager.Instance.getAvailableEncoders(),
    profile: CONFIG.TRANSCODING.PROFILE,

    audioPath: audioInputPath,
    resolution,

    job
  }

  try {
    await transcode(transcodeOptions)

    await remove(audioInputPath)
    await remove(tmpPreviewPath)
  } catch (err) {
    await remove(tmpPreviewPath)
    throw err
  }

  // Important to do this before getVideoFilename() to take in account the new file extension
  inputVideoFile.extname = newExtname

  const videoOutputPath = getVideoFilePath(video, inputVideoFile)
  // ffmpeg generated a new video file, so update the video duration
  // See https://trac.ffmpeg.org/ticket/5456
  video.duration = await getDurationFromVideoFile(videoTranscodedPath)
  await video.save()

  return onWebTorrentVideoFileTranscoding(video, inputVideoFile, videoTranscodedPath, videoOutputPath)
}

// Concat TS segments from a live video to a fragmented mp4 HLS playlist
async function generateHlsPlaylistResolutionFromTS (options: {
  video: MVideoWithFile
  concatenatedTsFilePath: string
  resolution: VideoResolution
  isPortraitMode: boolean
  isAAC: boolean
}) {
  return generateHlsPlaylistCommon({
    video: options.video,
    resolution: options.resolution,
    isPortraitMode: options.isPortraitMode,
    inputPath: options.concatenatedTsFilePath,
    type: 'hls-from-ts' as 'hls-from-ts',
    isAAC: options.isAAC
  })
}

// Generate an HLS playlist from an input file, and update the master playlist
function generateHlsPlaylistResolution (options: {
  video: MVideoWithFile
  videoInputPath: string
  resolution: VideoResolution
  copyCodecs: boolean
  isPortraitMode: boolean
  job?: Job
}) {
  return generateHlsPlaylistCommon({
    video: options.video,
    resolution: options.resolution,
    copyCodecs: options.copyCodecs,
    isPortraitMode: options.isPortraitMode,
    inputPath: options.videoInputPath,
    type: 'hls' as 'hls',
    job: options.job
  })
}

function getEnabledResolutions (type: 'vod' | 'live') {
  const transcoding = type === 'vod'
    ? CONFIG.TRANSCODING
    : CONFIG.LIVE.TRANSCODING

  return Object.keys(transcoding.RESOLUTIONS)
               .filter(key => transcoding.ENABLED && transcoding.RESOLUTIONS[key] === true)
               .map(r => parseInt(r, 10))
}

// ---------------------------------------------------------------------------

export {
  generateHlsPlaylistResolution,
  generateHlsPlaylistResolutionFromTS,
  optimizeOriginalVideofile,
  transcodeNewWebTorrentResolution,
  mergeAudioVideofile,
  getEnabledResolutions
}

// ---------------------------------------------------------------------------

async function onWebTorrentVideoFileTranscoding (
  video: MVideoWithFile,
  videoFile: MVideoFile,
  transcodingPath: string,
  outputPath: string
) {
  const stats = await stat(transcodingPath)
  const fps = await getVideoFileFPS(transcodingPath)
  const metadata = await getMetadataFromFile(transcodingPath)

  await move(transcodingPath, outputPath, { overwrite: true })

  videoFile.size = stats.size
  videoFile.fps = fps
  videoFile.metadata = metadata

  await createTorrentAndSetInfoHash(video, videoFile)

  await VideoFileModel.customUpsert(videoFile, 'video', undefined)
  video.VideoFiles = await video.$get('VideoFiles')

  return video
}

async function generateHlsPlaylistCommon (options: {
  type: 'hls' | 'hls-from-ts'
  video: MVideoWithFile
  inputPath: string
  resolution: VideoResolution
  copyCodecs?: boolean
  isAAC?: boolean
  isPortraitMode: boolean

  job?: Job
}) {
  const { type, video, inputPath, resolution, copyCodecs, isPortraitMode, isAAC, job } = options
  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR

  const videoTranscodedBasePath = join(transcodeDirectory, type)
  await ensureDir(videoTranscodedBasePath)

  const videoFilename = generateVideoStreamingPlaylistName(video.uuid, resolution)
  const playlistFilename = VideoStreamingPlaylistModel.getHlsPlaylistFilename(resolution)
  const playlistFileTranscodePath = join(videoTranscodedBasePath, playlistFilename)

  const transcodeOptions = {
    type,

    inputPath,
    outputPath: playlistFileTranscodePath,

    availableEncoders: VideoTranscodingProfilesManager.Instance.getAvailableEncoders(),
    profile: CONFIG.TRANSCODING.PROFILE,

    resolution,
    copyCodecs,
    isPortraitMode,

    isAAC,

    hlsPlaylist: {
      videoFilename
    },

    job
  }

  await transcode(transcodeOptions)

  const playlistUrl = WEBSERVER.URL + VideoStreamingPlaylistModel.getHlsMasterPlaylistStaticPath(video.uuid)

  // Create or update the playlist
  const [ videoStreamingPlaylist ] = await VideoStreamingPlaylistModel.upsert({
    videoId: video.id,
    playlistUrl,
    segmentsSha256Url: WEBSERVER.URL + VideoStreamingPlaylistModel.getHlsSha256SegmentsStaticPath(video.uuid, video.isLive),
    p2pMediaLoaderInfohashes: [],
    p2pMediaLoaderPeerVersion: P2P_MEDIA_LOADER_PEER_VERSION,

    type: VideoStreamingPlaylistType.HLS
  }, { returning: true }) as [ MStreamingPlaylistFilesVideo, boolean ]
  videoStreamingPlaylist.Video = video

  // Build the new playlist file
  const newVideoFile = new VideoFileModel({
    resolution,
    extname: extnameUtil(videoFilename),
    size: 0,
    fps: -1,
    videoStreamingPlaylistId: videoStreamingPlaylist.id
  })

  const videoFilePath = getVideoFilePath(videoStreamingPlaylist, newVideoFile)

  // Move files from tmp transcoded directory to the appropriate place
  const baseHlsDirectory = join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid)
  await ensureDir(baseHlsDirectory)

  // Move playlist file
  const playlistPath = join(baseHlsDirectory, playlistFilename)
  await move(playlistFileTranscodePath, playlistPath, { overwrite: true })
  // Move video file
  await move(join(videoTranscodedBasePath, videoFilename), videoFilePath, { overwrite: true })

  const stats = await stat(videoFilePath)

  newVideoFile.size = stats.size
  newVideoFile.fps = await getVideoFileFPS(videoFilePath)
  newVideoFile.metadata = await getMetadataFromFile(videoFilePath)

  await createTorrentAndSetInfoHash(videoStreamingPlaylist, newVideoFile)

  await VideoFileModel.customUpsert(newVideoFile, 'streaming-playlist', undefined)
  videoStreamingPlaylist.VideoFiles = await videoStreamingPlaylist.$get('VideoFiles')

  videoStreamingPlaylist.p2pMediaLoaderInfohashes = VideoStreamingPlaylistModel.buildP2PMediaLoaderInfoHashes(
    playlistUrl, videoStreamingPlaylist.VideoFiles
  )
  await videoStreamingPlaylist.save()

  video.setHLSPlaylist(videoStreamingPlaylist)

  await updateMasterHLSPlaylist(video)
  await updateSha256VODSegments(video)

  return playlistPath
}
