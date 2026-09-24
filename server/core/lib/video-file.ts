import {
  ffprobePromise,
  getVideoStreamDimensionsInfo,
  getVideoStreamFPS,
  hasAudioStream,
  hasVideoStream,
  isAudioFile
} from '@peertube/peertube-ffmpeg'
import {
  FileStorage,
  FileStorageType,
  VideoFileFormatFlag,
  VideoFileMetadata,
  VideoFileStream,
  VideoResolution,
  VideoStreamingPlaylistType
} from '@peertube/peertube-models'
import { getFileSize, getLowercaseExtension } from '@peertube/peertube-node-utils'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { MIMETYPES } from '@server/initializers/constants.js'
import { isObjectStorageEnabledFor } from '@server/lib/object-storage/config.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoSourceModel } from '@server/models/video/video-source.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { MStreamingPlaylistFiles, MVideo, MVideoFile, MVideoId, MVideoWithAllFiles } from '@server/types/models/index.js'
import { FfprobeData } from 'fluent-ffmpeg'
import { copy, move, remove } from 'fs-extra/esm'
import { updateM3U8AndShaPlaylistUnderLock } from './hls.js'
import { downloadStagingObject } from './object-storage/staging.js'
import {
  copyStagingObjectToWebVideoFile,
  copyWebVideoFileToOriginalVideoFile,
  removeWebVideoObjectStorage,
  storeOriginalVideoFile,
  storeWebVideoFile
} from './object-storage/videos.js'
import { generateHLSVideoFilename, generateWebVideoFilename } from './paths.js'
import { VideoPathManager } from './video-path-manager.js'

const logger = createLogger()

// A local file, or a URL FFmpeg can read
export type FFmpegInput = { path: string } | { url: string, size: number, extname: string }

function getUrlOrPath (input: FFmpegInput) {
  return 'path' in input ? input.path : input.url
}

export async function buildNewFile (options: {
  input: FFmpegInput
  mode: 'web-video' | 'hls'
  ffprobe?: FfprobeData
}): Promise<MVideoFile> {
  const { input, mode, ffprobe: probeArg } = options

  const urlOrPath = getUrlOrPath(input)

  const probe = probeArg ?? await ffprobePromise(urlOrPath)
  const size = 'path' in input ? await getFileSize(input.path) : input.size

  const videoFile = new VideoFileModel({
    extname: 'path' in input ? getLowercaseExtension(input.path) : input.extname,
    size,
    metadata: await buildFileMetadata(urlOrPath, probe),

    streams: VideoFileStream.NONE,

    formatFlags: mode === 'web-video'
      ? VideoFileFormatFlag.WEB_VIDEO
      : VideoFileFormatFlag.FRAGMENTED
  })

  if (await hasAudioStream(urlOrPath, probe)) {
    videoFile.streams |= VideoFileStream.AUDIO
  }

  if (await hasVideoStream(urlOrPath, probe)) {
    videoFile.streams |= VideoFileStream.VIDEO
  }

  if (await isAudioFile(urlOrPath, probe)) {
    videoFile.fps = 0
    videoFile.resolution = VideoResolution.H_NOVIDEO
    videoFile.width = 0
    videoFile.height = 0
  } else {
    const dimensions = await getVideoStreamDimensionsInfo(urlOrPath, probe)
    videoFile.fps = await getVideoStreamFPS(urlOrPath, probe)
    videoFile.resolution = dimensions.resolution
    videoFile.width = dimensions.width
    videoFile.height = dimensions.height
  }

  videoFile.filename = mode === 'web-video'
    ? generateWebVideoFilename(videoFile.resolution, videoFile.extname)
    : generateHLSVideoFilename(videoFile.resolution)

  return videoFile
}

// ---------------------------------------------------------------------------

// Lock the video
export async function removeHLSPlaylist (video: MVideoWithAllFiles) {
  const videoFileMutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    await removeHLSPlaylistUnderLock(video)
  } finally {
    videoFileMutexReleaser()
  }
}

export async function removeHLSPlaylistUnderLock (video: MVideoWithAllFiles) {
  // Reload the playlist: another process may have updated it while we were waiting for the lock
  const hls = await VideoStreamingPlaylistModel.loadHLSByVideo(video.id)

  if (hls) {
    await video.removeAllStreamingPlaylistFiles({ playlist: hls })
    await hls.destroy()
  }

  video.VideoStreamingPlaylists = (video.VideoStreamingPlaylists || []).filter(p => p.type !== VideoStreamingPlaylistType.HLS)
}

// ---------------------------------------------------------------------------

// Also updates the HLS playlist files (master playlist, segments hashes...) that reference the removed files
export async function removeHLSFiles (video: MVideoWithAllFiles, fileIdsToDelete: number[]) {
  const videoFileMutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    // Reload the files: another process may have updated them while we were waiting for the lock
    const hls = await VideoStreamingPlaylistModel.loadHLSByVideo(video.id)
    if (!hls) return

    const files = await VideoFileModel.listByStreamingPlaylist(hls.id)

    const toDelete = files.filter(f => fileIdsToDelete.includes(f.id))
    if (toDelete.length === 0) return

    if (toDelete.length === files.length) {
      await removeHLSPlaylistUnderLock(video)
      return
    }

    for (const file of toDelete) {
      await video.removeStreamingPlaylistVideoFile(hls, file)
      await file.destroy()
    }

    // Keep the video object consistent for the caller
    const hlsWithFiles = hls as MStreamingPlaylistFiles
    hlsWithFiles.VideoFiles = files.filter(f => !fileIdsToDelete.includes(f.id))
    video.setHLSPlaylist(hlsWithFiles)

    // Must be done under the lock, so a concurrent update of the playlist files by another process is not overwritten
    await updateM3U8AndShaPlaylistUnderLock(video, hls)
  } finally {
    videoFileMutexReleaser()
  }
}

// ---------------------------------------------------------------------------

export async function removeAllWebVideoFiles (video: MVideoWithAllFiles, options: {
  resolutionExceptions?: number[]
} = {}) {
  const videoFileMutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    return await removeAllWebVideoFilesUnderLock(video, options)
  } finally {
    videoFileMutexReleaser()
  }
}

export async function removeAllWebVideoFilesUnderLock (video: MVideoWithAllFiles, options: {
  resolutionExceptions?: number[]
} = {}) {
  const { resolutionExceptions = [] } = options

  // Reload the files: another job may have updated them while we were waiting for the lock
  const files = await video.$get('VideoFiles')
  video.VideoFiles = files

  for (const file of files) {
    if (resolutionExceptions.includes(file.resolution)) continue

    await video.removeWebVideoFile(file)
    await file.destroy()

    video.VideoFiles = video.VideoFiles.filter(f => f.id !== file.id)
  }

  return video
}

// ---------------------------------------------------------------------------

export async function removeWebVideoFile (video: MVideoWithAllFiles, fileToDeleteId: number) {
  const videoFileMutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    // Reload the file: another job may have updated it while we were waiting for the lock
    const toDelete = await VideoFileModel.load(fileToDeleteId)

    if (toDelete) {
      await video.removeWebVideoFile(toDelete)
      await toDelete.destroy()
    }

    video.VideoFiles = video.VideoFiles.filter(f => f.id !== fileToDeleteId)
  } finally {
    videoFileMutexReleaser()
  }

  return video
}

// ---------------------------------------------------------------------------

export async function buildFileMetadata (path: string, existingProbe?: FfprobeData) {
  const metadata = existingProbe || await ffprobePromise(path)

  return new VideoFileMetadata(metadata)
}

export function getVideoFileMimeType (extname: string, isAudio: boolean) {
  return isAudio && extname === '.mp4' // We use .mp4 even for audio file only
    ? MIMETYPES.AUDIO.EXT_MIMETYPE['.m4a']
    : MIMETYPES.VIDEO.EXT_MIMETYPE[extname]
}

// ---------------------------------------------------------------------------

export async function createVideoSource (options: {
  inputFilename: string
  inputFile: FFmpegInput | undefined // undefined with a live
  inputProbe: FfprobeData
  video: MVideoId
  createdAt?: Date
}) {
  const { inputFilename, inputFile, inputProbe, video, createdAt } = options

  const videoSource = new VideoSourceModel({
    inputFilename,
    videoId: video.id,
    createdAt
  })

  if (inputFile) {
    const inputPath = getUrlOrPath(inputFile)
    const probe = inputProbe ?? await ffprobePromise(inputPath)

    if (await isAudioFile(inputPath, probe)) {
      videoSource.fps = 0
      videoSource.resolution = VideoResolution.H_NOVIDEO
      videoSource.width = 0
      videoSource.height = 0
    } else {
      const dimensions = await getVideoStreamDimensionsInfo(inputPath, probe)
      videoSource.fps = await getVideoStreamFPS(inputPath, probe)
      videoSource.resolution = dimensions.resolution
      videoSource.width = dimensions.width
      videoSource.height = dimensions.height
    }

    videoSource.metadata = await buildFileMetadata(inputPath, probe)
    videoSource.size = 'path' in inputFile
      ? await getFileSize(inputFile.path)
      : inputFile.size
  }

  return videoSource.save()
}

export async function moveAndSaveNewOriginalFileIfNeeded (options: {
  video: MVideo
  webInputFile: MVideoFile
  webInputFilePath?: string // Local copy of the `webInputFile`, if the caller already has one
}) {
  const { video, webInputFile, webInputFilePath } = options

  if (!CONFIG.TRANSCODING.ORIGINAL_FILE.KEEP) return

  const videoSource = await VideoSourceModel.loadLatest(video.id)

  // Already have saved an original file
  if (!videoSource || videoSource.keptOriginalFilename) return
  videoSource.keptOriginalFilename = webInputFile.filename

  logger.info(`Storing original video file ${videoSource.keptOriginalFilename} of video ${video.name}`)

  if (webInputFile.storage === FileStorage.FILE_SYSTEM) {
    videoSource.storage = await storeOriginalFileFromDisk({
      inputPath: VideoPathManager.Instance.getFSVideoFileOutputPath(video, webInputFile),
      filename: videoSource.keptOriginalFilename,
      keepInput: false
    })
  } else { // Input file on object storage
    // oxlint-disable-next-line no-lonely-if
    if (isObjectStorageEnabledFor('original_video_files')) { // We can store original file on object storage
      await copyWebVideoFileToOriginalVideoFile(webInputFile, videoSource.keptOriginalFilename)
      videoSource.storage = FileStorage.OBJECT_STORAGE
    } else if (webInputFilePath) { // We must store original file on disk, but we have a local copy
      videoSource.storage = await storeOriginalFileFromDisk({
        inputPath: webInputFilePath,
        filename: videoSource.keptOriginalFilename,
        keepInput: true
      })
    } else { // We must store original file on disk, and we don't have a local copy
      videoSource.storage = await VideoPathManager.Instance.makeAvailableVideoFile(
        webInputFile.withVideoOrPlaylist(video),
        inputPath => {
          return storeOriginalFileFromDisk({ inputPath, filename: videoSource.keptOriginalFilename, keepInput: true })
        }
      )
    }
  }

  await videoSource.save()

  // Delete previously kept video files
  const allSources = await VideoSourceModel.listAll(video.id)
  for (const oldSource of allSources) {
    if (!oldSource.keptOriginalFilename) continue
    if (oldSource.id === videoSource.id) continue

    try {
      await video.removeOriginalFile(oldSource)
    } catch (err) {
      logger.error('Cannot delete old original file ' + oldSource.keptOriginalFilename, { err })
    }
  }
}

async function storeOriginalFileFromDisk (options: {
  inputPath: string
  filename: string
  keepInput: boolean
}): Promise<FileStorageType> {
  const { inputPath, filename, keepInput } = options

  if (isObjectStorageEnabledFor('original_video_files')) {
    await storeOriginalVideoFile(inputPath, filename)
    if (!keepInput) await remove(inputPath)

    return FileStorage.OBJECT_STORAGE
  }

  const destinationPath = VideoPathManager.Instance.getFSOriginalVideoFilePath(filename)

  if (keepInput) await copy(inputPath, destinationPath)
  else await move(inputPath, destinationPath)

  return FileStorage.FILE_SYSTEM
}

// ---------------------------------------------------------------------------

export function getNewWebVideoFileStorage (): FileStorageType {
  return isObjectStorageEnabledFor('web_videos')
    ? FileStorage.OBJECT_STORAGE
    : FileStorage.FILE_SYSTEM
}

export function getNewHLSPlaylistStorage (): FileStorageType {
  return isObjectStorageEnabledFor('streaming_playlists')
    ? FileStorage.OBJECT_STORAGE
    : FileStorage.FILE_SYSTEM
}

// Store a new web video file generated in `inputPath`, and set its storage
// Returns a local path of the file, available until `cleanup` is called
// The caller must hold the video files lock: the file location/ACL depends on the video privacy
export async function storeNewWebVideoFile (options: {
  video: MVideo
  videoFile: MVideoFile
  input: { path: string } | { stagingKey: string } // Local file, or a file in object storage staging
  keepInput?: boolean // default false, only for a local file
}) {
  const { video, videoFile, input, keepInput = false } = options

  videoFile.storage = getNewWebVideoFileStorage()

  if ('stagingKey' in input) return storeNewStagedWebVideoFile({ video, videoFile, stagingKey: input.stagingKey })

  const path = input.path

  if (videoFile.storage === FileStorage.OBJECT_STORAGE) {
    try {
      await storeWebVideoFile(video, videoFile, path)
    } catch (err) {
      if (!keepInput) await remove(path)

      throw err
    }

    return {
      localPath: path,

      // DB success
      cleanup: async () => {
        if (!keepInput) await remove(path)
      },

      // DB rollback
      rollback: async () => {
        await removeWebVideoObjectStorage(videoFile)
          .catch(err => logger.error('Cannot remove object storage file %s after a rollback.', videoFile.filename, { err }))

        if (!keepInput) await remove(path)
      }
    }
  }

  const outputPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, videoFile)

  if (keepInput) await copy(path, outputPath)
  else await move(path, outputPath, { overwrite: true })

  return {
    localPath: outputPath,
    cleanup: () => Promise.resolve(),
    rollback: () => remove(outputPath)
  }
}

// `localPath` is undefined if the file is stored on object storage
async function storeNewStagedWebVideoFile (options: {
  video: MVideo
  videoFile: MVideoFile
  stagingKey: string
}): Promise<{ localPath: string | undefined, cleanup: () => Promise<void>, rollback: () => Promise<void> }> {
  const { video, videoFile, stagingKey } = options

  if (videoFile.storage === FileStorage.OBJECT_STORAGE) {
    await copyStagingObjectToWebVideoFile(video, videoFile, stagingKey)

    return {
      localPath: undefined,
      cleanup: () => Promise.resolve(),
      rollback: async () => {
        await removeWebVideoObjectStorage(videoFile)
          .catch(err => logger.error('Cannot remove object storage file %s after a rollback.', videoFile.filename, { err }))
      }
    }
  }

  // web_videos moved back to the file system while the upload was staged
  const outputPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, videoFile)
  await downloadStagingObject({ key: stagingKey, destination: outputPath })

  return {
    localPath: outputPath,
    cleanup: () => Promise.resolve(),
    rollback: () => remove(outputPath)
  }
}
