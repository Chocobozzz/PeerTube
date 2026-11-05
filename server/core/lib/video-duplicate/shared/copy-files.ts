import { FileStorage, FileStorageType, VideoFileFormatFlag, VideoStreamingPlaylistType } from '@peertube/peertube-models'
import { buildUUID, buildUUIDv5 } from '@peertube/peertube-node-utils'
import { runTransaction } from '@server/helpers/database-utils.js'
import { CONFIG } from '@server/initializers/config.js'
import { P2P_MEDIA_LOADER_PEER_VERSION } from '@server/initializers/constants.js'
import { copySha256Segments, renameVideoFileInPlaylist } from '@server/lib/hls.js'
import { copyObjectToCommonFile, removeCommonFileObjectStorage } from '@server/lib/object-storage/common-files.js'
import { CommonObjectStorageType, getObjectStorageFileConfig } from '@server/lib/object-storage/config.js'
import {
  copyHLSFile,
  generateCommonFileObjectStorageKey,
  generateHLSObjectStorageKey,
  makeHLSFileAvailable,
  removeHLSObjectStorage,
  storeHLSFileFromPath
} from '@server/lib/object-storage/index.js'
import {
  generateHLSMasterPlaylistFilename,
  generateHLSVideoFilename,
  generateHlsSha256SegmentsFilename,
  generateWebVideoFilename,
  getHLSDirectory,
  getHLSResolutionPlaylistFilename
} from '@server/lib/paths.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoSourceModel } from '@server/models/video/video-source.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { VideoModel } from '@server/models/video/video.js'
import {
  MStreamingPlaylist,
  MStreamingPlaylistFilesVideo,
  MVideo,
  MVideoCaption,
  MVideoFile,
  MVideoFull,
  MVideoWithFile
} from '@server/types/models/index.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'
import { copy, remove } from 'fs-extra/esm'
import { extname, join } from 'path'

export type Rollback = () => Promise<any>

// Copy max quality files and captions
export async function copyMaxQualityFiles (options: {
  source: MVideoFull
  video: MVideoFull
  rollbacks: Rollback[]
}) {
  const { source, video, rollbacks } = options

  const captions = await copyCaptions({ source, video, rollbacks })

  const files: MVideoFile[] = []

  for (const sourceFile of getInputFiles(source)) {
    const file = buildFileCopy({
      sourceFile,
      filename: generateWebVideoFilename(sourceFile.resolution, sourceFile.extname, buildCopyUUID(video, sourceFile.filename))
    })
    file.formatFlags = VideoFileFormatFlag.WEB_VIDEO
    file.videoId = video.id

    await copyToWebVideoFile({ source, sourceFile, video, file, rollbacks })

    files.push(file)
  }

  await saveCopies({ video, webVideoFiles: files, captions })
}

// Returns the filename of each copy -> its source file
export async function copyAllFiles (options: {
  source: MVideoFull
  video: MVideoFull
  rollbacks: Rollback[]
}) {
  const { source, video, rollbacks } = options

  const captions = await copyCaptions({ source, video, rollbacks })
  const videoSource = await copyVideoSource({ source, video, rollbacks })

  // Filename of the copy -> source file
  const sourceFiles = new Map<string, MVideoFile>()

  const webVideoFiles: MVideoFile[] = []

  for (const sourceFile of source.VideoFiles) {
    const file = buildFileCopy({
      sourceFile,
      filename: generateWebVideoFilename(sourceFile.resolution, sourceFile.extname, buildCopyUUID(video, sourceFile.filename))
    })
    file.videoId = video.id

    await copyToWebVideoFile({ source, sourceFile, video, file, rollbacks })

    webVideoFiles.push(file)
    sourceFiles.set(file.filename, sourceFile)
  }

  const sourcePlaylist = source.getHLSPlaylist()

  const hls = sourcePlaylist
    ? await copyHLSPlaylist({ source, sourcePlaylist, video, sourceFiles, rollbacks })
    : undefined

  await saveCopies({ video, webVideoFiles, hls, captions, videoSource })

  return sourceFiles
}

export async function copyCommonFile (options: {
  type: CommonObjectStorageType
  source: { filename: string, storage: FileStorageType, size?: number } & ({ fsPath: string } | { getFSPath: () => string })
  destination: { filename: string } & ({ fsPath: string } | { getFSPath: () => string })
  isPrivate: boolean
}) {
  const { type, source, destination, isPrivate } = options

  if (source.storage === FileStorage.OBJECT_STORAGE) {
    return copyObjectToCommonFile({
      sourceKey: generateCommonFileObjectStorageKey(type, source.filename),
      sourceBucketInfo: getObjectStorageFileConfig(type),
      sourceSize: source.size,
      type,
      filename: destination.filename,
      isPrivate
    })
  }

  await copy(getFSPath(source), getFSPath(destination))
}

export function getInputFilenames (video: MVideoWithFile) {
  return getInputFiles(video).map(f => f.filename)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildCopyUUID (video: MVideo, sourceFilename: string) {
  return buildUUIDv5(sourceFilename, video.uuid)
}

async function saveCopies (options: {
  video: MVideo
  webVideoFiles: MVideoFile[]
  hls?: { playlist: MStreamingPlaylist, files: MVideoFile[] }
  captions: MVideoCaption[]
  videoSource?: MVideoSource
}) {
  const { video, webVideoFiles, hls, captions, videoSource } = options

  await runTransaction(async transaction => {
    // The video may have been deleted while its files were copied
    if (!await VideoModel.load(video.id, transaction)) throw new Error(`Video ${video.uuid} does not exist anymore`)

    for (const file of webVideoFiles) {
      await file.save({ transaction })
    }

    if (hls) {
      await hls.playlist.save({ transaction })

      for (const file of hls.files) {
        file.videoStreamingPlaylistId = hls.playlist.id
        await file.save({ transaction })
      }
    }

    for (const caption of captions) {
      await caption.save({ transaction })
    }

    if (videoSource) await videoSource.save({ transaction })
  })
}

async function copyHLSPlaylist (options: {
  source: MVideoFull
  sourcePlaylist: MStreamingPlaylistFilesVideo
  video: MVideoFull
  sourceFiles: Map<string, MVideoFile>
  rollbacks: Rollback[]
}) {
  const { source, sourcePlaylist, video, sourceFiles, rollbacks } = options

  const playlist = new VideoStreamingPlaylistModel({
    type: VideoStreamingPlaylistType.HLS,
    p2pMediaLoaderPeerVersion: P2P_MEDIA_LOADER_PEER_VERSION,
    storage: sourcePlaylist.storage,
    playlistFilename: generateHLSMasterPlaylistFilename(),
    segmentsSha256Filename: generateHlsSha256SegmentsFilename(),
    videoId: video.id
  }) as MStreamingPlaylist

  rollbacks.push(() => {
    return playlist.storage === FileStorage.OBJECT_STORAGE
      ? removeHLSObjectStorage(video)
      : remove(getHLSDirectory(video))
  })

  const files: MVideoFile[] = []

  // Source filename -> filename of the copy
  const filenames = new Map<string, string>()

  for (const sourceFile of sourcePlaylist.VideoFiles) {
    const file = buildFileCopy({
      sourceFile,
      filename: generateHLSVideoFilename(sourceFile.resolution, buildCopyUUID(video, sourceFile.filename))
    })

    await copyHLSFileAndResolutionPlaylist({ source, sourceFile, video, file })

    files.push(file)
    sourceFiles.set(file.filename, sourceFile)
    filenames.set(sourceFile.filename, file.filename)
  }

  // Segments don't have to be hashed again when generating the master playlist
  await copySha256Segments({ sourcePlaylist, playlist, video, filenames })

  // The master playlist is generated at the end of the duplication process

  return { playlist, files }
}

async function copyHLSFileAndResolutionPlaylist (options: {
  source: MVideoFull
  sourceFile: MVideoFile
  video: MVideoFull
  file: MVideoFile
}) {
  const { source, sourceFile, video, file } = options

  const sourceResolutionPlaylistFilename = getHLSResolutionPlaylistFilename(sourceFile.filename)
  const resolutionPlaylistFilename = getHLSResolutionPlaylistFilename(file.filename)

  if (file.storage === FileStorage.OBJECT_STORAGE) {
    await copyHLSFile({
      sourceVideo: source,
      sourceFilename: sourceFile.filename,
      sourceSize: sourceFile.size,
      video,
      filename: file.filename
    })

    // The resolution playlist references the video file by its filename
    const tmpPath = join(CONFIG.STORAGE.TMP_DIR, buildUUID() + '.m3u8')

    try {
      await makeHLSFileAvailable(source, sourceResolutionPlaylistFilename, tmpPath)
      await renameVideoFileInPlaylist(tmpPath, file.filename)
      await storeHLSFileFromPath(video, tmpPath, resolutionPlaylistFilename)
    } finally {
      await remove(tmpPath)
    }

    return
  }

  const sourceDirectory = getHLSDirectory(source)
  const directory = getHLSDirectory(video)

  await copy(join(sourceDirectory, sourceFile.filename), join(directory, file.filename))

  const resolutionPlaylistPath = join(directory, resolutionPlaylistFilename)
  await copy(join(sourceDirectory, sourceResolutionPlaylistFilename), resolutionPlaylistPath)
  await renameVideoFileInPlaylist(resolutionPlaylistPath, file.filename)
}

function buildFileCopy (options: {
  sourceFile: MVideoFile
  filename: string
}) {
  const { sourceFile, filename } = options

  return new VideoFileModel({
    resolution: sourceFile.resolution,
    width: sourceFile.width,
    height: sourceFile.height,
    size: sourceFile.size,
    extname: sourceFile.extname,
    fps: sourceFile.fps,
    formatFlags: sourceFile.formatFlags,
    streams: sourceFile.streams,
    metadata: sourceFile.metadata,
    storage: sourceFile.storage,
    filename
  }) as MVideoFile
}

async function copyToWebVideoFile (options: {
  source: MVideoFull
  sourceFile: MVideoFile
  video: MVideoFull
  file: MVideoFile
  rollbacks: Rollback[]
}) {
  const { source, sourceFile, video, file, rollbacks } = options

  if (file.storage === FileStorage.OBJECT_STORAGE) {
    rollbacks.push(() => removeCommonFileObjectStorage('web_videos', file.filename))

    await copyObjectToCommonFile({
      sourceKey: sourceFile.isHLS()
        ? generateHLSObjectStorageKey(source, sourceFile.filename)
        : generateCommonFileObjectStorageKey('web_videos', sourceFile.filename),
      sourceBucketInfo: sourceFile.isHLS()
        ? CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS
        : getObjectStorageFileConfig('web_videos'),
      sourceSize: sourceFile.size,
      type: 'web_videos',
      filename: file.filename,
      isPrivate: video.hasPrivateStaticPath()
    })

    return
  }

  const path = VideoPathManager.Instance.getFSVideoFileOutputPath(video, file)
  rollbacks.push(() => remove(path))

  const sourcePath = sourceFile.isHLS()
    ? VideoPathManager.Instance.getFSVideoFileOutputPath(source.getHLSPlaylist(), sourceFile)
    : VideoPathManager.Instance.getFSVideoFileOutputPath(source, sourceFile)

  await copy(sourcePath, path)
}

async function copyCaptions (options: {
  source: MVideo
  video: MVideo
  rollbacks: Rollback[]
}) {
  const { source, video, rollbacks } = options

  const result: MVideoCaption[] = []

  // The user may have added captions to the duplicate while it was waiting for its files
  const existingLanguages = new Set((await VideoCaptionModel.listVideoCaptions(video.id)).map(c => c.language))

  for (const sourceCaption of await VideoCaptionModel.listVideoCaptions(source.id)) {
    if (existingLanguages.has(sourceCaption.language)) continue

    const caption = new VideoCaptionModel({
      videoId: video.id,
      filename: VideoCaptionModel.generateCaptionName(sourceCaption.language, buildCopyUUID(video, sourceCaption.filename)),
      storage: sourceCaption.storage,
      language: sourceCaption.language,
      automaticallyGenerated: sourceCaption.automaticallyGenerated,
      cached: false
    }) as MVideoCaption

    rollbacks.push(() => caption.removeCaptionFile())

    await copyCommonFile({
      type: 'captions',
      source: { filename: sourceCaption.filename, storage: sourceCaption.storage, fsPath: sourceCaption.getFSFilePath() },
      destination: { filename: caption.filename, fsPath: caption.getFSFilePath() },
      isPrivate: false
    })

    result.push(caption)
  }

  return result
}

async function copyVideoSource (options: {
  source: MVideo
  video: MVideo
  rollbacks: Rollback[]
}) {
  const { source, video, rollbacks } = options

  const sourceVideoSource = await VideoSourceModel.loadLatest(source.id)
  if (!sourceVideoSource) return undefined

  const videoSource = new VideoSourceModel({
    inputFilename: sourceVideoSource.inputFilename,
    resolution: sourceVideoSource.resolution,
    width: sourceVideoSource.width,
    height: sourceVideoSource.height,
    fps: sourceVideoSource.fps,
    size: sourceVideoSource.size,
    metadata: sourceVideoSource.metadata,
    videoId: video.id
  }) as MVideoSource

  if (!sourceVideoSource.keptOriginalFilename) return videoSource

  videoSource.keptOriginalFilename = generateWebVideoFilename(
    sourceVideoSource.resolution,
    extname(sourceVideoSource.keptOriginalFilename),
    buildCopyUUID(video, sourceVideoSource.keptOriginalFilename)
  )
  videoSource.storage = sourceVideoSource.storage

  const fsPath = VideoPathManager.Instance.getFSOriginalVideoFilePath(videoSource.keptOriginalFilename)

  rollbacks.push(() => {
    return videoSource.storage === FileStorage.OBJECT_STORAGE
      ? removeCommonFileObjectStorage('original_video_files', videoSource.keptOriginalFilename)
      : remove(fsPath)
  })

  await copyCommonFile({
    type: 'original_video_files',
    source: {
      filename: sourceVideoSource.keptOriginalFilename,
      storage: sourceVideoSource.storage,
      fsPath: VideoPathManager.Instance.getFSOriginalVideoFilePath(sourceVideoSource.keptOriginalFilename),
      size: sourceVideoSource.size
    },
    destination: { filename: videoSource.keptOriginalFilename, fsPath },
    isPrivate: true
  })

  return videoSource
}

function getInputFiles (video: MVideoWithFile) {
  const { videoFile, separatedAudioFile } = video.getMaxQualityAudioAndVideoFiles()

  return [ videoFile, separatedAudioFile ].filter(f => !!f)
}

function getFSPath (file: { fsPath: string } | { getFSPath: () => string }) {
  return 'fsPath' in file
    ? file.fsPath
    : file.getFSPath()
}
