import { VideoFileModel } from '../models/video/video-file'
import { generateImageFromVideoFile } from '../helpers/ffmpeg-utils'
import { CONFIG } from '../initializers/config'
import { PREVIEWS_SIZE, THUMBNAILS_SIZE, ASSETS_PATH } from '../initializers/constants'
import { VideoModel } from '../models/video/video'
import { ThumbnailModel } from '../models/video/thumbnail'
import { ThumbnailType } from '../../shared/models/videos/thumbnail.type'
import { processImage } from '../helpers/image-utils'
import { join } from 'path'
import { downloadImage } from '../helpers/requests'
import { VideoPlaylistModel } from '../models/video/video-playlist'

type ImageSize = { height: number, width: number }

function createPlaylistMiniatureFromExisting (
  inputPath: string,
  playlist: VideoPlaylistModel,
  automaticallyGenerated: boolean,
  keepOriginal = false,
  size?: ImageSize
) {
  const { filename, outputPath, height, width, existingThumbnail } = buildMetadataFromPlaylist(playlist, size)
  const type = ThumbnailType.MINIATURE

  const thumbnailCreator = () => processImage(inputPath, outputPath, { width, height }, keepOriginal)
  return createThumbnailFromFunction({ thumbnailCreator, filename, height, width, type, automaticallyGenerated, existingThumbnail })
}

function createPlaylistMiniatureFromUrl (fileUrl: string, playlist: VideoPlaylistModel, size?: ImageSize) {
  const { filename, basePath, height, width, existingThumbnail } = buildMetadataFromPlaylist(playlist, size)
  const type = ThumbnailType.MINIATURE

  const thumbnailCreator = () => downloadImage(fileUrl, basePath, filename, { width, height })
  return createThumbnailFromFunction({ thumbnailCreator, filename, height, width, type, existingThumbnail, fileUrl })
}

function createVideoMiniatureFromUrl (fileUrl: string, video: VideoModel, type: ThumbnailType, size?: ImageSize) {
  const { filename, basePath, height, width, existingThumbnail } = buildMetadataFromVideo(video, type, size)
  const thumbnailCreator = () => downloadImage(fileUrl, basePath, filename, { width, height })

  return createThumbnailFromFunction({ thumbnailCreator, filename, height, width, type, existingThumbnail, fileUrl })
}

function createVideoMiniatureFromExisting (
  inputPath: string,
  video: VideoModel,
  type: ThumbnailType,
  automaticallyGenerated: boolean,
  size?: ImageSize
) {
  const { filename, outputPath, height, width, existingThumbnail } = buildMetadataFromVideo(video, type, size)
  const thumbnailCreator = () => processImage(inputPath, outputPath, { width, height })

  return createThumbnailFromFunction({ thumbnailCreator, filename, height, width, type, automaticallyGenerated, existingThumbnail })
}

function generateVideoMiniature (video: VideoModel, videoFile: VideoFileModel, type: ThumbnailType) {
  const input = video.getVideoFilePath(videoFile)

  const { filename, basePath, height, width, existingThumbnail, outputPath } = buildMetadataFromVideo(video, type)
  const thumbnailCreator = videoFile.isAudio()
    ? () => processImage(ASSETS_PATH.DEFAULT_AUDIO_BACKGROUND, outputPath, { width, height }, true)
    : () => generateImageFromVideoFile(input, basePath, filename, { height, width })

  return createThumbnailFromFunction({ thumbnailCreator, filename, height, width, type, automaticallyGenerated: true, existingThumbnail })
}

function createPlaceholderThumbnail (fileUrl: string, video: VideoModel, type: ThumbnailType, size: ImageSize) {
  const { filename, height, width, existingThumbnail } = buildMetadataFromVideo(video, type, size)

  const thumbnail = existingThumbnail ? existingThumbnail : new ThumbnailModel()

  thumbnail.filename = filename
  thumbnail.height = height
  thumbnail.width = width
  thumbnail.type = type
  thumbnail.fileUrl = fileUrl

  return thumbnail
}

// ---------------------------------------------------------------------------

export {
  generateVideoMiniature,
  createVideoMiniatureFromUrl,
  createVideoMiniatureFromExisting,
  createPlaceholderThumbnail,
  createPlaylistMiniatureFromUrl,
  createPlaylistMiniatureFromExisting
}

function buildMetadataFromPlaylist (playlist: VideoPlaylistModel, size: ImageSize) {
  const filename = playlist.generateThumbnailName()
  const basePath = CONFIG.STORAGE.THUMBNAILS_DIR

  return {
    filename,
    basePath,
    existingThumbnail: playlist.Thumbnail,
    outputPath: join(basePath, filename),
    height: size ? size.height : THUMBNAILS_SIZE.height,
    width: size ? size.width : THUMBNAILS_SIZE.width
  }
}

function buildMetadataFromVideo (video: VideoModel, type: ThumbnailType, size?: ImageSize) {
  const existingThumbnail = Array.isArray(video.Thumbnails)
    ? video.Thumbnails.find(t => t.type === type)
    : undefined

  if (type === ThumbnailType.MINIATURE) {
    const filename = video.generateThumbnailName()
    const basePath = CONFIG.STORAGE.THUMBNAILS_DIR

    return {
      filename,
      basePath,
      existingThumbnail,
      outputPath: join(basePath, filename),
      height: size ? size.height : THUMBNAILS_SIZE.height,
      width: size ? size.width : THUMBNAILS_SIZE.width
    }
  }

  if (type === ThumbnailType.PREVIEW) {
    const filename = video.generatePreviewName()
    const basePath = CONFIG.STORAGE.PREVIEWS_DIR

    return {
      filename,
      basePath,
      existingThumbnail,
      outputPath: join(basePath, filename),
      height: size ? size.height : PREVIEWS_SIZE.height,
      width: size ? size.width : PREVIEWS_SIZE.width
    }
  }

  return undefined
}

async function createThumbnailFromFunction (parameters: {
  thumbnailCreator: () => Promise<any>,
  filename: string,
  height: number,
  width: number,
  type: ThumbnailType,
  automaticallyGenerated?: boolean,
  fileUrl?: string,
  existingThumbnail?: ThumbnailModel
}) {
  const { thumbnailCreator, filename, width, height, type, existingThumbnail, automaticallyGenerated = null, fileUrl = null } = parameters

  const thumbnail = existingThumbnail ? existingThumbnail : new ThumbnailModel()

  thumbnail.filename = filename
  thumbnail.height = height
  thumbnail.width = width
  thumbnail.type = type
  thumbnail.fileUrl = fileUrl
  thumbnail.automaticallyGenerated = automaticallyGenerated

  await thumbnailCreator()

  return thumbnail
}
