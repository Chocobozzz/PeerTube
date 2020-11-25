import { copyFile, ensureDir, move, remove, stat } from 'fs-extra'
import { basename, extname as extnameUtil, join } from 'path'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { MStreamingPlaylistFilesVideo, MVideoFile, MVideoWithAllFiles, MVideoWithFile } from '@server/types/models'
import { getTargetBitrate, VideoResolution } from '../../shared/models/videos'
import { VideoStreamingPlaylistType } from '../../shared/models/videos/video-streaming-playlist.type'
import { AvailableEncoders, EncoderOptionsBuilder, transcode, TranscodeOptions, TranscodeOptionsType } from '../helpers/ffmpeg-utils'
import {
  canDoQuickTranscode,
  getAudioStream,
  getDurationFromVideoFile,
  getMaxAudioBitrate,
  getMetadataFromFile,
  getVideoFileBitrate,
  getVideoFileFPS
} from '../helpers/ffprobe-utils'
import { logger } from '../helpers/logger'
import { CONFIG } from '../initializers/config'
import {
  HLS_STREAMING_PLAYLIST_DIRECTORY,
  P2P_MEDIA_LOADER_PEER_VERSION,
  VIDEO_TRANSCODING_FPS,
  WEBSERVER
} from '../initializers/constants'
import { VideoFileModel } from '../models/video/video-file'
import { VideoStreamingPlaylistModel } from '../models/video/video-streaming-playlist'
import { updateMasterHLSPlaylist, updateSha256VODSegments } from './hls'
import { generateVideoStreamingPlaylistName, getVideoFilename, getVideoFilePath } from './video-paths'

/**
 * Optimize the original video file and replace it. The resolution is not changed.
 */
async function optimizeOriginalVideofile (video: MVideoWithFile, inputVideoFileArg?: MVideoFile) {
  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR
  const newExtname = '.mp4'

  const inputVideoFile = inputVideoFileArg || video.getMaxQualityFile()
  const videoInputPath = getVideoFilePath(video, inputVideoFile)
  const videoTranscodedPath = join(transcodeDirectory, video.id + '-transcoded' + newExtname)

  const transcodeType: TranscodeOptionsType = await canDoQuickTranscode(videoInputPath)
    ? 'quick-transcode'
    : 'video'

  const transcodeOptions: TranscodeOptions = {
    type: transcodeType,

    inputPath: videoInputPath,
    outputPath: videoTranscodedPath,

    availableEncoders,
    profile: 'default',

    resolution: inputVideoFile.resolution
  }

  // Could be very long!
  await transcode(transcodeOptions)

  try {
    await remove(videoInputPath)

    // Important to do this before getVideoFilename() to take in account the new file extension
    inputVideoFile.extname = newExtname

    const videoOutputPath = getVideoFilePath(video, inputVideoFile)

    await onVideoFileTranscoding(video, inputVideoFile, videoTranscodedPath, videoOutputPath)
  } catch (err) {
    // Auto destruction...
    video.destroy().catch(err => logger.error('Cannot destruct video after transcoding failure.', { err }))

    throw err
  }
}

/**
 * Transcode the original video file to a lower resolution.
 */
async function transcodeNewResolution (video: MVideoWithFile, resolution: VideoResolution, isPortrait: boolean) {
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

      availableEncoders,
      profile: 'default',

      resolution
    }
    : {
      type: 'video' as 'video',
      inputPath: videoInputPath,
      outputPath: videoTranscodedPath,

      availableEncoders,
      profile: 'default',

      resolution,
      isPortraitMode: isPortrait
    }

  await transcode(transcodeOptions)

  return onVideoFileTranscoding(video, newVideoFile, videoTranscodedPath, videoOutputPath)
}

async function mergeAudioVideofile (video: MVideoWithAllFiles, resolution: VideoResolution) {
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

    availableEncoders,
    profile: 'default',

    audioPath: audioInputPath,
    resolution
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

  return onVideoFileTranscoding(video, inputVideoFile, videoTranscodedPath, videoOutputPath)
}

async function generateHlsPlaylist (options: {
  video: MVideoWithFile
  videoInputPath: string
  resolution: VideoResolution
  copyCodecs: boolean
  isPortraitMode: boolean
}) {
  const { video, videoInputPath, resolution, copyCodecs, isPortraitMode } = options

  const baseHlsDirectory = join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid)
  await ensureDir(join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid))

  const outputPath = join(baseHlsDirectory, VideoStreamingPlaylistModel.getHlsPlaylistFilename(resolution))
  const videoFilename = generateVideoStreamingPlaylistName(video.uuid, resolution)

  const transcodeOptions = {
    type: 'hls' as 'hls',

    inputPath: videoInputPath,
    outputPath,

    availableEncoders,
    profile: 'default',

    resolution,
    copyCodecs,
    isPortraitMode,

    hlsPlaylist: {
      videoFilename
    }
  }

  await transcode(transcodeOptions)

  const playlistUrl = WEBSERVER.URL + VideoStreamingPlaylistModel.getHlsMasterPlaylistStaticPath(video.uuid)

  const [ videoStreamingPlaylist ] = await VideoStreamingPlaylistModel.upsert({
    videoId: video.id,
    playlistUrl,
    segmentsSha256Url: WEBSERVER.URL + VideoStreamingPlaylistModel.getHlsSha256SegmentsStaticPath(video.uuid, video.isLive),
    p2pMediaLoaderInfohashes: [],
    p2pMediaLoaderPeerVersion: P2P_MEDIA_LOADER_PEER_VERSION,

    type: VideoStreamingPlaylistType.HLS
  }, { returning: true }) as [ MStreamingPlaylistFilesVideo, boolean ]
  videoStreamingPlaylist.Video = video

  const newVideoFile = new VideoFileModel({
    resolution,
    extname: extnameUtil(videoFilename),
    size: 0,
    fps: -1,
    videoStreamingPlaylistId: videoStreamingPlaylist.id
  })

  const videoFilePath = getVideoFilePath(videoStreamingPlaylist, newVideoFile)
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

  return video
}

// ---------------------------------------------------------------------------
// Available encoders profiles
// ---------------------------------------------------------------------------

const defaultX264OptionsBuilder: EncoderOptionsBuilder = async ({ input, resolution, fps }) => {
  if (!fps) return { outputOptions: [] }

  let targetBitrate = getTargetBitrate(resolution, fps, VIDEO_TRANSCODING_FPS)

  // Don't transcode to an higher bitrate than the original file
  const fileBitrate = await getVideoFileBitrate(input)
  targetBitrate = Math.min(targetBitrate, fileBitrate)

  return {
    outputOptions: [
      // Constrained Encoding (VBV)
      // https://slhck.info/video/2017/03/01/rate-control.html
      // https://trac.ffmpeg.org/wiki/Limiting%20the%20output%20bitrate
      `-maxrate ${targetBitrate}`, `-bufsize ${targetBitrate * 2}`
    ]
  }
}

const defaultAACOptionsBuilder: EncoderOptionsBuilder = async ({ input }) => {
  const parsedAudio = await getAudioStream(input)

  // we try to reduce the ceiling bitrate by making rough matches of bitrates
  // of course this is far from perfect, but it might save some space in the end

  const audioCodecName = parsedAudio.audioStream['codec_name']

  const bitrate = getMaxAudioBitrate(audioCodecName, parsedAudio.bitrate)

  if (bitrate !== undefined && bitrate !== -1) {
    return { outputOptions: [ '-b:a', bitrate + 'k' ] }
  }

  return { outputOptions: [] }
}

const defaultLibFDKAACOptionsBuilder: EncoderOptionsBuilder = () => {
  return { outputOptions: [ '-aq', '5' ] }
}

const availableEncoders: AvailableEncoders = {
  vod: {
    libx264: {
      default: defaultX264OptionsBuilder
    },
    aac: {
      default: defaultAACOptionsBuilder
    },
    libfdkAAC: {
      default: defaultLibFDKAACOptionsBuilder
    }
  },
  live: {
    libx264: {
      default: defaultX264OptionsBuilder
    },
    aac: {
      default: defaultAACOptionsBuilder
    },
    libfdkAAC: {
      default: defaultLibFDKAACOptionsBuilder
    }
  }
}

// ---------------------------------------------------------------------------

export {
  generateHlsPlaylist,
  optimizeOriginalVideofile,
  transcodeNewResolution,
  mergeAudioVideofile
}

// ---------------------------------------------------------------------------

async function onVideoFileTranscoding (video: MVideoWithFile, videoFile: MVideoFile, transcodingPath: string, outputPath: string) {
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
