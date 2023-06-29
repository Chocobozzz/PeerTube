import { join } from 'path'
import { ThumbnailType } from '@shared/models'
import { generateImageFilename, generateImageFromVideoFile } from '../helpers/image-utils'
import { CONFIG } from '../initializers/config'
import { ASSETS_PATH, PREVIEWS_SIZE, THUMBNAILS_SIZE } from '../initializers/constants'
import { ThumbnailModel } from '../models/video/thumbnail'
import { MVideoFile, MVideoThumbnail, MVideoUUID } from '../types/models'
import { MThumbnail } from '../types/models/video/thumbnail'
import { MVideoPlaylistThumbnail } from '../types/models/video/video-playlist'
import { VideoPathManager } from './video-path-manager'
import { downloadImageFromWorker, processImageFromWorker } from './worker/parent-process'

type ImageSize = { height?: number, width?: number }

function updateLocalPlaylistMiniatureFromExisting (options: {
  inputPath: string
  playlist: MVideoPlaylistThumbnail
  automaticallyGenerated: boolean
  keepOriginal?: boolean // default to false
  size?: ImageSize
}) {
  const { inputPath, playlist, automaticallyGenerated, keepOriginal = false, size } = options
  const { filename, outputPath, height, width, existingThumbnail } = buildMetadataFromPlaylist(playlist, size)
  const type = ThumbnailType.MINIATURE

  const thumbnailCreator = () => {
    return processImageFromWorker({ path: inputPath, destination: outputPath, newSize: { width, height }, keepOriginal })
  }

  return updateThumbnailFromFunction({
    thumbnailCreator,
    filename,
    height,
    width,
    type,
    automaticallyGenerated,
    onDisk: true,
    existingThumbnail
  })
}

function updateRemotePlaylistMiniatureFromUrl (options: {
  downloadUrl: string
  playlist: MVideoPlaylistThumbnail
  size?: ImageSize
}) {
  const { downloadUrl, playlist, size } = options
  const { filename, basePath, height, width, existingThumbnail } = buildMetadataFromPlaylist(playlist, size)
  const type = ThumbnailType.MINIATURE

  // Only save the file URL if it is a remote playlist
  const fileUrl = playlist.isOwned()
    ? null
    : downloadUrl

  const thumbnailCreator = () => {
    return downloadImageFromWorker({ url: downloadUrl, destDir: basePath, destName: filename, size: { width, height } })
  }

  return updateThumbnailFromFunction({ thumbnailCreator, filename, height, width, type, existingThumbnail, fileUrl, onDisk: true })
}

function updateLocalVideoMiniatureFromExisting (options: {
  inputPath: string
  video: MVideoThumbnail
  type: ThumbnailType
  automaticallyGenerated: boolean
  size?: ImageSize
  keepOriginal?: boolean // default to false
}) {
  const { inputPath, video, type, automaticallyGenerated, size, keepOriginal = false } = options

  const { filename, outputPath, height, width, existingThumbnail } = buildMetadataFromVideo(video, type, size)

  const thumbnailCreator = () => {
    return processImageFromWorker({ path: inputPath, destination: outputPath, newSize: { width, height }, keepOriginal })
  }

  return updateThumbnailFromFunction({
    thumbnailCreator,
    filename,
    height,
    width,
    type,
    automaticallyGenerated,
    existingThumbnail,
    onDisk: true
  })
}

function generateLocalVideoMiniature (options: {
  video: MVideoThumbnail
  videoFile: MVideoFile
  type: ThumbnailType
}) {
  const { video, videoFile, type } = options

  return VideoPathManager.Instance.makeAvailableVideoFile(videoFile.withVideoOrPlaylist(video), input => {
    const { filename, basePath, height, width, existingThumbnail, outputPath } = buildMetadataFromVideo(video, type)

    const thumbnailCreator = videoFile.isAudio()
      ? () => processImageFromWorker({
        path: ASSETS_PATH.DEFAULT_AUDIO_BACKGROUND,
        destination: outputPath,
        newSize: { width, height },
        keepOriginal: true
      })
      : () => generateImageFromVideoFile({
        fromPath: input,
        folder: basePath,
        imageName: filename,
        size: { height, width }
      })

    return updateThumbnailFromFunction({
      thumbnailCreator,
      filename,
      height,
      width,
      type,
      automaticallyGenerated: true,
      onDisk: true,
      existingThumbnail
    })
  })
}

// ---------------------------------------------------------------------------

function updateLocalVideoMiniatureFromUrl (options: {
  downloadUrl: string
  video: MVideoThumbnail
  type: ThumbnailType
  size?: ImageSize
}) {
  const { downloadUrl, video, type, size } = options
  const { filename: updatedFilename, basePath, height, width, existingThumbnail } = buildMetadataFromVideo(video, type, size)

  // Only save the file URL if it is a remote video
  const fileUrl = video.isOwned()
    ? null
    : downloadUrl

  const thumbnailUrlChanged = hasThumbnailUrlChanged(existingThumbnail, downloadUrl, video)

  // Do not change the thumbnail filename if the file did not change
  const filename = thumbnailUrlChanged
    ? updatedFilename
    : existingThumbnail.filename

  const thumbnailCreator = () => {
    if (thumbnailUrlChanged) {
      return downloadImageFromWorker({ url: downloadUrl, destDir: basePath, destName: filename, size: { width, height } })
    }

    return Promise.resolve()
  }

  return updateThumbnailFromFunction({ thumbnailCreator, filename, height, width, type, existingThumbnail, fileUrl, onDisk: true })
}

function updateRemoteVideoThumbnail (options: {
  fileUrl: string
  video: MVideoThumbnail
  type: ThumbnailType
  size: ImageSize
  onDisk: boolean
}) {
  const { fileUrl, video, type, size, onDisk } = options
  const { filename: generatedFilename, height, width, existingThumbnail } = buildMetadataFromVideo(video, type, size)

  const thumbnail = existingThumbnail || new ThumbnailModel()

  // Do not change the thumbnail filename if the file did not change
  if (hasThumbnailUrlChanged(existingThumbnail, fileUrl, video)) {
    thumbnail.filename = generatedFilename
  }

  thumbnail.height = height
  thumbnail.width = width
  thumbnail.type = type
  thumbnail.fileUrl = fileUrl
  thumbnail.onDisk = onDisk

  return thumbnail
}

// ---------------------------------------------------------------------------

export {
  generateLocalVideoMiniature,
  updateLocalVideoMiniatureFromUrl,
  updateLocalVideoMiniatureFromExisting,
  updateRemoteVideoThumbnail,
  updateRemotePlaylistMiniatureFromUrl,
  updateLocalPlaylistMiniatureFromExisting
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function hasThumbnailUrlChanged (existingThumbnail: MThumbnail, downloadUrl: string, video: MVideoUUID) {
  const existingUrl = existingThumbnail
    ? existingThumbnail.fileUrl
    : null

  // If the thumbnail URL did not change and has a unique filename (introduced in 3.1), avoid thumbnail processing
  return !existingUrl || existingUrl !== downloadUrl || downloadUrl.endsWith(`${video.uuid}.jpg`)
}

function buildMetadataFromPlaylist (playlist: MVideoPlaylistThumbnail, size: ImageSize) {
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

function buildMetadataFromVideo (video: MVideoThumbnail, type: ThumbnailType, size?: ImageSize) {
  const existingThumbnail = Array.isArray(video.Thumbnails)
    ? video.Thumbnails.find(t => t.type === type)
    : undefined

  if (type === ThumbnailType.MINIATURE) {
    const filename = generateImageFilename()
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
    const filename = generateImageFilename()
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

async function updateThumbnailFromFunction (parameters: {
  thumbnailCreator: () => Promise<any>
  filename: string
  height: number
  width: number
  type: ThumbnailType
  onDisk: boolean
  automaticallyGenerated?: boolean
  fileUrl?: string
  existingThumbnail?: MThumbnail
}) {
  const {
    thumbnailCreator,
    filename,
    width,
    height,
    type,
    existingThumbnail,
    onDisk,
    automaticallyGenerated = null,
    fileUrl = null
  } = parameters

  const oldFilename = existingThumbnail && existingThumbnail.filename !== filename
    ? existingThumbnail.filename
    : undefined

  const thumbnail: MThumbnail = existingThumbnail || new ThumbnailModel()

  thumbnail.filename = filename
  thumbnail.height = height
  thumbnail.width = width
  thumbnail.type = type
  thumbnail.fileUrl = fileUrl
  thumbnail.automaticallyGenerated = automaticallyGenerated
  thumbnail.onDisk = onDisk

  if (oldFilename) thumbnail.previousThumbnailFilename = oldFilename

  await thumbnailCreator()

  return thumbnail
}
