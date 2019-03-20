import { CONFIG, HLS_STREAMING_PLAYLIST_DIRECTORY } from '../initializers'
import { join } from 'path'
import { getVideoFileFPS, transcode } from '../helpers/ffmpeg-utils'
import { ensureDir, move, remove, stat } from 'fs-extra'
import { logger } from '../helpers/logger'
import { VideoResolution } from '../../shared/models/videos'
import { VideoFileModel } from '../models/video/video-file'
import { VideoModel } from '../models/video/video'
import { updateMasterHLSPlaylist, updateSha256Segments } from './hls'
import { VideoStreamingPlaylistModel } from '../models/video/video-streaming-playlist'
import { VideoStreamingPlaylistType } from '../../shared/models/videos/video-streaming-playlist.type'

async function optimizeVideofile (video: VideoModel, inputVideoFileArg?: VideoFileModel) {
  const videosDirectory = CONFIG.STORAGE.VIDEOS_DIR
  const newExtname = '.mp4'

  const inputVideoFile = inputVideoFileArg ? inputVideoFileArg : video.getOriginalFile()
  const videoInputPath = join(videosDirectory, video.getVideoFilename(inputVideoFile))
  const videoTranscodedPath = join(videosDirectory, video.id + '-transcoded' + newExtname)

  const transcodeOptions = {
    inputPath: videoInputPath,
    outputPath: videoTranscodedPath,
    resolution: inputVideoFile.resolution
  }

  // Could be very long!
  await transcode(transcodeOptions)

  try {
    await remove(videoInputPath)

    // Important to do this before getVideoFilename() to take in account the new file extension
    inputVideoFile.set('extname', newExtname)

    const videoOutputPath = video.getVideoFilePath(inputVideoFile)
    await move(videoTranscodedPath, videoOutputPath)
    const stats = await stat(videoOutputPath)
    const fps = await getVideoFileFPS(videoOutputPath)

    inputVideoFile.set('size', stats.size)
    inputVideoFile.set('fps', fps)

    await video.createTorrentAndSetInfoHash(inputVideoFile)
    await inputVideoFile.save()
  } catch (err) {
    // Auto destruction...
    video.destroy().catch(err => logger.error('Cannot destruct video after transcoding failure.', { err }))

    throw err
  }
}

async function transcodeOriginalVideofile (video: VideoModel, resolution: VideoResolution, isPortrait: boolean) {
  const videosDirectory = CONFIG.STORAGE.VIDEOS_DIR
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

  const transcodeOptions = {
    inputPath: videoInputPath,
    outputPath: videoOutputPath,
    resolution,
    isPortraitMode: isPortrait
  }

  await transcode(transcodeOptions)

  const stats = await stat(videoOutputPath)
  const fps = await getVideoFileFPS(videoOutputPath)

  newVideoFile.set('size', stats.size)
  newVideoFile.set('fps', fps)

  await video.createTorrentAndSetInfoHash(newVideoFile)

  await newVideoFile.save()

  video.VideoFiles.push(newVideoFile)
}

async function generateHlsPlaylist (video: VideoModel, resolution: VideoResolution, isPortraitMode: boolean) {
  const baseHlsDirectory = join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid)
  await ensureDir(join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid))

  const videoInputPath = join(CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename(video.getOriginalFile()))
  const outputPath = join(baseHlsDirectory, VideoStreamingPlaylistModel.getHlsPlaylistFilename(resolution))

  const transcodeOptions = {
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

  const playlistUrl = CONFIG.WEBSERVER.URL + VideoStreamingPlaylistModel.getHlsMasterPlaylistStaticPath(video.uuid)

  await VideoStreamingPlaylistModel.upsert({
    videoId: video.id,
    playlistUrl,
    segmentsSha256Url: CONFIG.WEBSERVER.URL + VideoStreamingPlaylistModel.getHlsSha256SegmentsStaticPath(video.uuid),
    p2pMediaLoaderInfohashes: VideoStreamingPlaylistModel.buildP2PMediaLoaderInfoHashes(playlistUrl, video.VideoFiles),

    type: VideoStreamingPlaylistType.HLS
  })
}

export {
  generateHlsPlaylist,
  optimizeVideofile,
  transcodeOriginalVideofile
}
