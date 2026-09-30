import { FileStorage } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { isSecondaryProcess } from '@server/initializers/process-role.js'
import { QueryTypes } from 'sequelize'
import { PrunableObjectStorageSection } from './object-storage/config.js'
import { LocalFilesMove, RedisChannels } from './redis/index.js'

const logger = createLogger('local-files')

type Section = {
  // To name the files in logs
  label: string

  // Returns a row if a local file of this kind is stored on the file system
  query: string
}

const localVideoJoin = (table: string) => `INNER JOIN "video" "video" ON "video"."id" = "${table}"."videoId" AND "video"."remote" IS FALSE`

const sections: { [id in PrunableObjectStorageSection]: Section } = {
  avatars: {
    label: 'avatars and banners',
    query: 'SELECT 1 FROM "actorImage" WHERE "storage" = $storage AND "fileUrl" IS NULL LIMIT 1'
  },

  thumbnails: {
    label: 'thumbnails and previews',
    query: 'SELECT 1 FROM "thumbnail" WHERE "storage" = $storage AND "fileUrl" IS NULL LIMIT 1'
  },

  storyboards: {
    label: 'storyboards',
    query: 'SELECT 1 FROM "storyboard" WHERE "storage" = $storage AND "fileUrl" IS NULL LIMIT 1'
  },

  torrents: {
    label: 'torrents',
    query: 'SELECT 1 FROM "videoFile" ' +
      'LEFT JOIN "video" "webVideo" ON "webVideo"."id" = "videoFile"."videoId" AND "webVideo"."remote" IS FALSE ' +
      'LEFT JOIN "videoStreamingPlaylist" ON "videoStreamingPlaylist"."id" = "videoFile"."videoStreamingPlaylistId" ' +
      'LEFT JOIN "video" "hlsVideo" ON "hlsVideo"."id" = "videoStreamingPlaylist"."videoId" AND "hlsVideo"."remote" IS FALSE ' +
      'WHERE "videoFile"."torrentFilename" IS NOT NULL AND "videoFile"."torrentStorage" = $storage ' +
      'AND ("hlsVideo"."id" IS NOT NULL OR "webVideo"."id" IS NOT NULL) LIMIT 1'
  },

  uploads: {
    label: 'uploaded images (instance logos...)',
    query: 'SELECT 1 FROM "uploadImage" WHERE "storage" = $storage AND "fileUrl" IS NULL LIMIT 1'
  },

  captions: {
    label: 'captions',
    query: 'SELECT 1 FROM "videoCaption" ' + localVideoJoin('videoCaption') + ' ' +
      'WHERE "videoCaption"."storage" = $storage LIMIT 1'
  },

  original_video_files: {
    label: 'original video files',
    query: 'SELECT 1 FROM "videoSource" ' + localVideoJoin('videoSource') + ' ' +
      'WHERE "videoSource"."keptOriginalFilename" IS NOT NULL AND "videoSource"."storage" = $storage LIMIT 1'
  },

  web_videos: {
    label: 'web video files',
    query: 'SELECT 1 FROM "videoFile" ' + localVideoJoin('videoFile') + ' ' +
      'WHERE "videoFile"."storage" = $storage LIMIT 1'
  },

  streaming_playlists: {
    label: 'HLS video files',

    // Live streams are ignored: only the primary process writes their files during the live
    // And it removes them if a secondary deletes the video
    query: 'SELECT 1 FROM "videoStreamingPlaylist" ' + localVideoJoin('videoStreamingPlaylist') + ' ' +
      'WHERE "video"."isLive" IS FALSE AND (' +
      '"videoStreamingPlaylist"."storage" = $storage OR EXISTS (' +
      'SELECT 1 FROM "videoFile" WHERE "videoFile"."videoStreamingPlaylistId" = "videoStreamingPlaylist"."id" ' +
      'AND "videoFile"."storage" = $storage' +
      ')) LIMIT 1'
  },

  user_exports: {
    label: 'user exports',
    query: 'SELECT 1 FROM "userExport" WHERE "storage" = $storage LIMIT 1'
  }
}

const CHECK_DELAY_MS = 1000

const CHECK_INTERVAL_WITH_PROBLEMS_MS = 60000

export class HorizontalScalabilityStorage {
  private static instance: HorizontalScalabilityStorage

  // Secondary process only
  private problems: string[] = []
  private checkTimeout: NodeJS.Timeout
  private problemsInterval: NodeJS.Timeout
  private stopped = false

  private constructor () {}

  async init () {
    if (!isSecondaryProcess()) return

    return this.initSecondary()
  }

  stop () {
    this.stopped = true

    clearTimeout(this.checkTimeout)
    this.checkTimeout = undefined

    clearInterval(this.problemsInterval)
    this.problemsInterval = undefined
  }

  // Primary process: files have been moved from a storage to another
  notifyFilesMoved (move: LocalFilesMove) {
    RedisChannels.localFilesMoved.broadcast(move)
  }

  // ---------------------------------------------------------------------------
  // Secondary
  // ---------------------------------------------------------------------------

  private async initSecondary () {
    // Before the first check, so a move during the check is not missed
    await RedisChannels.localFilesMoved.subscribe(move => {
      if (move === 'moved-to-object-storage' && this.problems.length === 0) return
      if (move === 'moved-to-file-system' && this.problems.length !== 0) return

      this.scheduleCheck()
    })

    this.problems = await this.findProblems()

    if (this.problems.length !== 0) {
      throw new Error(
        'This secondary process cannot reach the files of the primary process (avatars, thumbnails, video files...):\n' +
          this.problems.join('\n')
      )
    }
  }

  private scheduleCheck () {
    if (this.stopped || this.checkTimeout) return

    this.checkTimeout = setTimeout(() => {
      this.checkTimeout = undefined

      this.check()
        .catch(err => logger.error('Cannot check whether this process can reach the files of the primary process.', { err }))
    }, CHECK_DELAY_MS)
  }

  private async check () {
    const hadProblems = this.problems.length !== 0

    this.problems = await this.findProblems()

    if (this.problems.length === 0) {
      if (hadProblems) logger.info('This secondary process can reach the files of the primary process again.')

      clearInterval(this.problemsInterval)
      this.problemsInterval = undefined

      return
    }

    logger.error(
      'This secondary process cannot reach the files of the primary process anymore: the endpoints writing files may fail ' +
        'or write them in the wrong place. Fix these problems or stop this process:\n' + this.problems.join('\n')
    )

    if (!this.problemsInterval && !this.stopped) {
      // Log the problems periodically
      this.problemsInterval = setInterval(() => this.scheduleCheck(), CHECK_INTERVAL_WITH_PROBLEMS_MS)
      this.problemsInterval.unref()
    }
  }

  private async findProblems () {
    // Applies to every kind of file
    if (CONFIG.OBJECT_STORAGE.ENABLED !== true) {
      return [ ' - object storage is not enabled (object_storage.enabled)' ]
    }

    const problems: string[] = []

    for (const type of Object.keys(sections)) {
      if (!await this.hasLocalFilesOnFileSystem(sections[type])) continue

      problems.push(
        ` - ${sections[type].label}: some of them are still on the file system, ` +
          'move them to object storage using the create-move-file-storage-job script'
      )
    }

    return problems
  }

  // ---------------------------------------------------------------------------

  private async hasLocalFilesOnFileSystem (section: Section) {
    const rows = await sequelizeTypescript.query(section.query, {
      type: QueryTypes.SELECT,
      bind: { storage: FileStorage.FILE_SYSTEM }
    })

    return rows.length !== 0
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
