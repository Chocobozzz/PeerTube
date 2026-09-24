import { FileStorage } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { ShareableStorageDirectory } from '@server/initializers/storage-ownership.js'
import { QueryTypes } from 'sequelize'
import { isObjectStorageEnabledFor, ObjectStorageSectionType } from '../object-storage/config.js'

type SharedFilesSection = {
  // To name the files in logs
  label: string

  // Storage directories a secondary on the same host as the primary must share to reach every local file of this kind
  shareableStorageDirectories: ShareableStorageDirectory[]

  // Returns a row if a local file of this kind is stored on the file system
  localFilesOnFileSystemQuery: string

  // No new file of this kind can be created
  isDisabled?: () => boolean
}

export type SharedFilesSectionType = ObjectStorageSectionType

const localVideoJoin = (table: string) => `INNER JOIN "video" "video" ON "video"."id" = "${table}"."videoId" AND "video"."remote" IS FALSE`

export const sharedFilesSections: { [id in SharedFilesSectionType]: SharedFilesSection } = {
  avatars: {
    label: 'avatars and banners',
    shareableStorageDirectories: [ 'ACTOR_IMAGES_DIR' ],
    localFilesOnFileSystemQuery: 'SELECT 1 FROM "actorImage" WHERE "storage" = $storage AND "fileUrl" IS NULL LIMIT 1'
  },

  thumbnails: {
    label: 'thumbnails and previews',
    shareableStorageDirectories: [ 'THUMBNAILS_DIR', 'PREVIEWS_DIR' ],
    localFilesOnFileSystemQuery: 'SELECT 1 FROM "thumbnail" WHERE "storage" = $storage AND "fileUrl" IS NULL LIMIT 1'
  },

  storyboards: {
    label: 'storyboards',
    shareableStorageDirectories: [ 'STORYBOARDS_DIR' ],
    localFilesOnFileSystemQuery: 'SELECT 1 FROM "storyboard" WHERE "storage" = $storage AND "fileUrl" IS NULL LIMIT 1'
  },

  torrents: {
    label: 'torrents',
    shareableStorageDirectories: [ 'TORRENTS_DIR' ],
    localFilesOnFileSystemQuery: 'SELECT 1 FROM "videoFile" ' +
      'LEFT JOIN "video" "webVideo" ON "webVideo"."id" = "videoFile"."videoId" AND "webVideo"."remote" IS FALSE ' +
      'LEFT JOIN "videoStreamingPlaylist" ON "videoStreamingPlaylist"."id" = "videoFile"."videoStreamingPlaylistId" ' +
      'LEFT JOIN "video" "hlsVideo" ON "hlsVideo"."id" = "videoStreamingPlaylist"."videoId" AND "hlsVideo"."remote" IS FALSE ' +
      'WHERE "videoFile"."torrentFilename" IS NOT NULL AND "videoFile"."torrentStorage" = $storage ' +
      'AND ("hlsVideo"."id" IS NOT NULL OR "webVideo"."id" IS NOT NULL) LIMIT 1'
  },

  uploads: {
    label: 'uploaded images (instance logos...)',
    shareableStorageDirectories: [ 'UPLOADS_DIR' ],
    localFilesOnFileSystemQuery: 'SELECT 1 FROM "uploadImage" WHERE "storage" = $storage AND "fileUrl" IS NULL LIMIT 1'
  },

  captions: {
    label: 'captions',
    shareableStorageDirectories: [ 'CAPTIONS_DIR' ],
    localFilesOnFileSystemQuery: 'SELECT 1 FROM "videoCaption" ' + localVideoJoin('videoCaption') + ' ' +
      'WHERE "videoCaption"."storage" = $storage LIMIT 1'
  },

  original_video_files: {
    label: 'original video files',
    shareableStorageDirectories: [ 'ORIGINAL_VIDEO_FILES_DIR' ],
    localFilesOnFileSystemQuery: 'SELECT 1 FROM "videoSource" ' + localVideoJoin('videoSource') + ' ' +
      'WHERE "videoSource"."keptOriginalFilename" IS NOT NULL AND "videoSource"."storage" = $storage LIMIT 1'
  },

  web_videos: {
    label: 'web video files',
    shareableStorageDirectories: [ 'WEB_VIDEOS_DIR' ],
    localFilesOnFileSystemQuery: 'SELECT 1 FROM "videoFile" ' + localVideoJoin('videoFile') + ' ' +
      'WHERE "videoFile"."storage" = $storage LIMIT 1'
  },

  streaming_playlists: {
    label: 'HLS video files',
    shareableStorageDirectories: [ 'STREAMING_PLAYLISTS_DIR' ],

    // Live streams are ignored: only the primary process writes their files during the live
    // And it removes them if a secondary deletes the video
    localFilesOnFileSystemQuery: 'SELECT 1 FROM "videoStreamingPlaylist" ' + localVideoJoin('videoStreamingPlaylist') + ' ' +
      'WHERE "video"."isLive" IS FALSE AND (' +
      '"videoStreamingPlaylist"."storage" = $storage OR EXISTS (' +
      'SELECT 1 FROM "videoFile" WHERE "videoFile"."videoStreamingPlaylistId" = "videoStreamingPlaylist"."id" ' +
      'AND "videoFile"."storage" = $storage' +
      ')) LIMIT 1'
  },

  user_exports: {
    label: 'user exports',
    shareableStorageDirectories: [ 'TMP_PERSISTENT_DIR' ],
    localFilesOnFileSystemQuery: 'SELECT 1 FROM "userExport" WHERE "storage" = $storage LIMIT 1',

    isDisabled: () => CONFIG.EXPORT.USERS.ENABLED !== true
  }
}

export const sharedFilesSectionTypes = Object.keys(sharedFilesSections)

// ---------------------------------------------------------------------------

export type SharedFilesSectionStatus = {
  // Every local file of this kind is in object storage, and new ones will be stored there too
  inObjectStorage: boolean

  // Why they are not
  reasons: string[]
}

export async function computeSharedFilesSectionStatus (type: SharedFilesSectionType): Promise<SharedFilesSectionStatus> {
  const section = sharedFilesSections[type]
  const reasons: string[] = []

  if (!isObjectStorageEnabledFor(type) && section.isDisabled?.() !== true) {
    reasons.push(`object storage is not enabled for them (object_storage.enabled and object_storage.${type}.enabled)`)
  }

  if (await hasLocalFilesOnFileSystem(section)) {
    reasons.push('some of them are still on the file system: move them to object storage using the create-move-file-storage-job script')
  }

  return { inObjectStorage: reasons.length === 0, reasons }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function hasLocalFilesOnFileSystem (section: SharedFilesSection) {
  const rows = await sequelizeTypescript.query(section.localFilesOnFileSystemQuery, {
    type: QueryTypes.SELECT,
    bind: { storage: FileStorage.FILE_SYSTEM }
  })

  return rows.length !== 0
}
