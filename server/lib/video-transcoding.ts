import { HLS_STREAMING_PLAYLIST_DIRECTORY, P2P_MEDIA_LOADER_PEER_VERSION, WEBSERVER } from '../initializers/constants'
import { join } from 'path'
import { canDoQuickTranscode, getVideoFileFPS, transcode, TranscodeOptions, TranscodeOptionsType } from '../helpers/ffmpeg-utils'
import { ensureDir, move, remove, stat } from 'fs-extra'
import { logger } from '../helpers/logger'
import { VideoResolution } from '../../shared/models/videos'
import { VideoFileModel } from '../models/video/video-file'
import { updateMasterHLSPlaylist, updateSha256Segments } from './hls'
import { VideoStreamingPlaylistModel } from '../models/video/video-streaming-playlist'
import { VideoStreamingPlaylistType } from '../../shared/models/videos/video-streaming-playlist.type'
import { CONFIG } from '../initializers/config'
import { MVideoFile, MVideoWithFile, MVideoWithFileThumbnail } from '@server/typings/models'

/**
 * Optimize the original video file and replace it. The resolution is not changed.
 */
async function optimizeVideofile (video: MVideoWithFile, inputVideoFileArg?: MVideoFile) {
  const videosDirectory = CONFIG.STORAGE.VIDEOS_DIR
  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR
  const newExtname = '.mp4'

  const inputVideoFile = inputVideoFileArg ? inputVideoFileArg : video.getOriginalFile()
  const videoInputPath = join(videosDirectory, video.getVideoFilename(inputVideoFile))
  const videoTranscodedPath = join(transcodeDirectory, video.id + '-transcoded' + newExtname)

  const transcodeType: TranscodeOptionsType = await canDoQuickTranscode(videoInputPath)
    ? 'quick-transcode'
    : 'video'

  const transcodeOptions: TranscodeOptions = {
    type: transcodeType as any, // FIXME: typing issue
    inputPath: videoInputPath,
    outputPath: videoTranscodedPath,
    resolution: inputVideoFile.resolution
  }

  // Could be very long!
  await transcode(transcodeOptions)

  try {
    await remove(videoInputPath)

    // Important to do this before getVideoFilename() to take in account the new file extension
    inputVideoFile.extname = newExtname

    const videoOutputPath = video.getVideoFilePath(inputVideoFile)

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
async function transcodeOriginalVideofile (video: MVideoWithFile, resolution: VideoResolution, isPortrait: boolean) {
  const videosDirectory = CONFIG.STORAGE.VIDEOS_DIR
  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR
  const extname = '.mp4'

  // We are sure it's x264 in mp4 because optimizeOriginalVideofile was already executed
  const videoInputPath = join(videosDirectory, video.getVideoFilename(video.getOriginalFile()))

  const newVideoFile = new VideoFileModel({
    resolution,
    extname,
    size: 0,
    videoId: video.id
  })
  const videoOutputPath = join(CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename(newVideoFile))
  const videoTranscodedPath = join(transcodeDirectory, video.getVideoFilename(newVideoFile))

  const transcodeOptions = {
    type: 'video' as 'video',
    inputPath: videoInputPath,
    outputPath: videoTranscodedPath,
    resolution,
    isPortraitMode: isPortrait
  }

  await transcode(transcodeOptions)

  return onVideoFileTranscoding(video, newVideoFile, videoTranscodedPath, videoOutputPath)
}

async function mergeAudioVideofile (video: MVideoWithFileThumbnail, resolution: VideoResolution) {
  const videosDirectory = CONFIG.STORAGE.VIDEOS_DIR
  const transcodeDirectory = CONFIG.STORAGE.TMP_DIR
  const newExtname = '.mp4'

  const inputVideoFile = video.getOriginalFile()

  const audioInputPath = join(videosDirectory, video.getVideoFilename(video.getOriginalFile()))
  const videoTranscodedPath = join(transcodeDirectory, video.id + '-transcoded' + newExtname)

  const transcodeOptions = {
    type: 'merge-audio' as 'merge-audio',
    inputPath: video.getPreview().getPath(),
    outputPath: videoTranscodedPath,
    audioPath: audioInputPath,
    resolution
  }

  await transcode(transcodeOptions)

  await remove(audioInputPath)

  // Important to do this before getVideoFilename() to take in account the new file extension
  inputVideoFile.extname = newExtname

  const videoOutputPath = video.getVideoFilePath(inputVideoFile)

  return onVideoFileTranscoding(video, inputVideoFile, videoTranscodedPath, videoOutputPath)
}

async function generateHlsPlaylist (video: MVideoWithFile, resolution: VideoResolution, isPortraitMode: boolean) {
  const baseHlsDirectory = join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid)
  await ensureDir(join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid))

  const videoInputPath = join(CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename(video.getFile(resolution)))
  const outputPath = join(baseHlsDirectory, VideoStreamingPlaylistModel.getHlsPlaylistFilename(resolution))

  const transcodeOptions = {
    type: 'hls' as 'hls',
    inputPath: videoInputPath,
    outputPath,
    resolution,
    isPortraitMode,

    hlsPlaylist: {
      videoFilename: VideoStreamingPlaylistModel.getHlsVideoName(video.uuid, resolution)
    }
  }

  await transcode(transcodeOptions)

  await updateMasterHLSPlaylist(video)
  await updateSha256Segments(video)

  const playlistUrl = WEBSERVER.URL + VideoStreamingPlaylistModel.getHlsMasterPlaylistStaticPath(video.uuid)

  await VideoStreamingPlaylistModel.upsert({
    videoId: video.id,
    playlistUrl,
    segmentsSha256Url: WEBSERVER.URL + VideoStreamingPlaylistModel.getHlsSha256SegmentsStaticPath(video.uuid),
    p2pMediaLoaderInfohashes: VideoStreamingPlaylistModel.buildP2PMediaLoaderInfoHashes(playlistUrl, video.VideoFiles),
    p2pMediaLoaderPeerVersion: P2P_MEDIA_LOADER_PEER_VERSION,

    type: VideoStreamingPlaylistType.HLS
  })
}

// ---------------------------------------------------------------------------

export {
  generateHlsPlaylist,
  optimizeVideofile,
  transcodeOriginalVideofile,
  mergeAudioVideofile
}

// ---------------------------------------------------------------------------

async function onVideoFileTranscoding (video: MVideoWithFile, videoFile: MVideoFile, transcodingPath: string, outputPath: string) {
  const stats = await stat(transcodingPath)
  const fps = await getVideoFileFPS(transcodingPath)

  await move(transcodingPath, outputPath)

  videoFile.size = stats.size
  videoFile.fps = fps

  await video.createTorrentAndSetInfoHash(videoFile)

  const updatedVideoFile = await videoFile.save()

  // Add it if this is a new created file
  if (video.VideoFiles.some(f => f.id === videoFile.id) === false) {
    video.VideoFiles.push(updatedVideoFile)
  }

  return video
}
