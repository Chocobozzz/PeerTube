import { ActivityVideoUrlObject, FileStorage, VideoResolution, type FileStorageType } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { extractVideo } from '@server/helpers/video.js'
import { CONFIG } from '@server/initializers/config.js'
import { buildRemoteUrl } from '@server/lib/activitypub/url.js'
import {
  getHLSPrivateFileUrl,
  getObjectStoragePublicFileUrl,
  getWebVideoPrivateFileUrl
} from '@server/lib/object-storage/index.js'
import { getFSTorrentFilePath } from '@server/lib/paths.js'
import { getVideoFileMimeType } from '@server/lib/video-file.js'
import { isVideoInPrivateDirectory } from '@server/lib/video-privacy.js'
import { MStreamingPlaylistVideo, MVideo, MVideoWithHost, isStreamingPlaylist } from '@server/types/models/index.js'
import { remove } from 'fs-extra/esm'
import memoizee from 'memoizee'
import { join } from 'path'
import { FindOptions, Op, Transaction, WhereOptions } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DefaultScope,
  ForeignKey,
  HasMany,
  Is, Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import validator from 'validator'
import {
  isVideoFPSResolutionValid,
  isVideoFileExtnameValid,
  isVideoFileInfoHashValid,
  isVideoFileResolutionValid,
  isVideoFileSizeValid
} from '../../helpers/custom-validators/videos.js'
import {
  LAZY_STATIC_PATHS,
  MEMOIZE_LENGTH,
  MEMOIZE_TTL,
  STATIC_DOWNLOAD_PATHS,
  STATIC_PATHS,
  WEBSERVER
} from '../../initializers/constants.js'
import { MVideoFile, MVideoFileStreamingPlaylistVideo, MVideoFileVideo } from '../../types/models/video/video-file.js'
import { VideoRedundancyModel } from '../redundancy/video-redundancy.js'
import { SequelizeModel, doesExist, parseAggregateResult, throwIfNotValid } from '../shared/index.js'
import { VideoStreamingPlaylistModel } from './video-streaming-playlist.js'
import { VideoModel } from './video.js'

export enum ScopeNames {
  WITH_VIDEO = 'WITH_VIDEO',
  WITH_METADATA = 'WITH_METADATA',
  WITH_VIDEO_OR_PLAYLIST = 'WITH_VIDEO_OR_PLAYLIST'
}

@DefaultScope(() => ({
  attributes: {
    exclude: [ 'metadata' ]
  }
}))
@Scopes(() => ({
  [ScopeNames.WITH_VIDEO]: {
    include: [
      {
        model: VideoModel.unscoped(),
        required: true
      }
    ]
  },
  [ScopeNames.WITH_VIDEO_OR_PLAYLIST]: (options: { whereVideo?: WhereOptions } = {}) => {
    return {
      include: [
        {
          model: VideoModel.unscoped(),
          required: false,
          where: options.whereVideo
        },
        {
          model: VideoStreamingPlaylistModel.unscoped(),
          required: false,
          include: [
            {
              model: VideoModel.unscoped(),
              required: true,
              where: options.whereVideo
            }
          ]
        }
      ]
    }
  },
  [ScopeNames.WITH_METADATA]: {
    attributes: {
      include: [ 'metadata' ]
    }
  }
}))
@Table({
  tableName: 'videoFile',
  indexes: [
    {
      fields: [ 'videoId' ],
      where: {
        videoId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'videoStreamingPlaylistId' ],
      where: {
        videoStreamingPlaylistId: {
          [Op.ne]: null
        }
      }
    },

    {
      fields: [ 'infoHash' ]
    },

    {
      fields: [ 'torrentFilename' ],
      unique: true
    },

    {
      fields: [ 'filename' ],
      unique: true
    },

    {
      fields: [ 'videoId', 'resolution', 'fps' ],
      unique: true,
      where: {
        videoId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'videoStreamingPlaylistId', 'resolution', 'fps' ],
      unique: true,
      where: {
        videoStreamingPlaylistId: {
          [Op.ne]: null
        }
      }
    }
  ]
})
export class VideoFileModel extends SequelizeModel<VideoFileModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Is('VideoFileResolution', value => throwIfNotValid(value, isVideoFileResolutionValid, 'resolution'))
  @Column
  resolution: number

  @AllowNull(true)
  @Column
  width: number

  @AllowNull(true)
  @Column
  height: number

  @AllowNull(false)
  @Is('VideoFileSize', value => throwIfNotValid(value, isVideoFileSizeValid, 'size'))
  @Column(DataType.BIGINT)
  size: number

  @AllowNull(false)
  @Is('VideoFileExtname', value => throwIfNotValid(value, isVideoFileExtnameValid, 'extname'))
  @Column
  extname: string

  @AllowNull(true)
  @Is('VideoFileInfohash', value => throwIfNotValid(value, isVideoFileInfoHashValid, 'info hash', true))
  @Column
  infoHash: string

  @AllowNull(false)
  @Default(-1)
  @Is('VideoFileFPS', value => throwIfNotValid(value, isVideoFPSResolutionValid, 'fps'))
  @Column
  fps: number

  @AllowNull(true)
  @Column(DataType.JSONB)
  metadata: any

  @AllowNull(true)
  @Column
  metadataUrl: string

  // Could be null for remote files
  @AllowNull(true)
  @Column
  fileUrl: string

  // Could be null for live files
  @AllowNull(true)
  @Column
  filename: string

  // Could be null for remote files
  @AllowNull(true)
  @Column
  torrentUrl: string

  // Could be null for live files
  @AllowNull(true)
  @Column
  torrentFilename: string

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @AllowNull(false)
  @Default(FileStorage.FILE_SYSTEM)
  @Column
  storage: FileStorageType

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  Video: Awaited<VideoModel>

  @ForeignKey(() => VideoStreamingPlaylistModel)
  @Column
  videoStreamingPlaylistId: number

  @BelongsTo(() => VideoStreamingPlaylistModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  VideoStreamingPlaylist: Awaited<VideoStreamingPlaylistModel>

  @HasMany(() => VideoRedundancyModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  RedundancyVideos: Awaited<VideoRedundancyModel>[]

  static doesInfohashExistCached = memoizee(VideoFileModel.doesInfohashExist.bind(VideoFileModel), {
    promise: true,
    max: MEMOIZE_LENGTH.INFO_HASH_EXISTS,
    maxAge: MEMOIZE_TTL.INFO_HASH_EXISTS
  })

  static doesInfohashExist (infoHash: string) {
    const query = 'SELECT 1 FROM "videoFile" WHERE "infoHash" = $infoHash LIMIT 1'

    return doesExist({ sequelize: this.sequelize, query, bind: { infoHash } })
  }

  static async doesVideoExistForVideoFile (id: number, videoIdOrUUID: number | string) {
    const videoFile = await VideoFileModel.loadWithVideoOrPlaylist(id, videoIdOrUUID)

    return !!videoFile
  }

  static async doesOwnedTorrentFileExist (filename: string) {
    const query = 'SELECT 1 FROM "videoFile" ' +
                  'LEFT JOIN "video" "webvideo" ON "webvideo"."id" = "videoFile"."videoId" AND "webvideo"."remote" IS FALSE ' +
                  'LEFT JOIN "videoStreamingPlaylist" ON "videoStreamingPlaylist"."id" = "videoFile"."videoStreamingPlaylistId" ' +
                  'LEFT JOIN "video" "hlsVideo" ON "hlsVideo"."id" = "videoStreamingPlaylist"."videoId" AND "hlsVideo"."remote" IS FALSE ' +
                  'WHERE "torrentFilename" = $filename AND ("hlsVideo"."id" IS NOT NULL OR "webvideo"."id" IS NOT NULL) LIMIT 1'

    return doesExist({ sequelize: this.sequelize, query, bind: { filename } })
  }

  static async doesOwnedWebVideoFileExist (filename: string) {
    const query = 'SELECT 1 FROM "videoFile" INNER JOIN "video" ON "video"."id" = "videoFile"."videoId" AND "video"."remote" IS FALSE ' +
                  `WHERE "filename" = $filename AND "storage" = ${FileStorage.FILE_SYSTEM} LIMIT 1`

    return doesExist({ sequelize: this.sequelize, query, bind: { filename } })
  }

  static loadByFilename (filename: string) {
    const query = {
      where: {
        filename
      }
    }

    return VideoFileModel.findOne(query)
  }

  static loadWithVideoByFilename (filename: string): Promise<MVideoFileVideo | MVideoFileStreamingPlaylistVideo> {
    const query = {
      where: {
        filename
      }
    }

    return VideoFileModel.scope(ScopeNames.WITH_VIDEO_OR_PLAYLIST).findOne(query)
  }

  static loadWithVideoOrPlaylistByTorrentFilename (filename: string) {
    const query = {
      where: {
        torrentFilename: filename
      }
    }

    return VideoFileModel.scope(ScopeNames.WITH_VIDEO_OR_PLAYLIST).findOne(query)
  }

  static load (id: number): Promise<MVideoFile> {
    return VideoFileModel.findByPk(id)
  }

  static loadWithMetadata (id: number) {
    return VideoFileModel.scope(ScopeNames.WITH_METADATA).findByPk(id)
  }

  static loadWithVideo (id: number) {
    return VideoFileModel.scope(ScopeNames.WITH_VIDEO).findByPk(id)
  }

  static loadWithVideoOrPlaylist (id: number, videoIdOrUUID: number | string) {
    const whereVideo = validator.default.isUUID(videoIdOrUUID + '')
      ? { uuid: videoIdOrUUID }
      : { id: videoIdOrUUID }

    const options = {
      where: {
        id
      }
    }

    return VideoFileModel.scope({ method: [ ScopeNames.WITH_VIDEO_OR_PLAYLIST, whereVideo ] })
      .findOne(options)
      .then(file => {
        // We used `required: false` so check we have at least a video or a streaming playlist
        if (!file.Video && !file.VideoStreamingPlaylist) return null

        return file
      })
  }

  static listByStreamingPlaylist (streamingPlaylistId: number, transaction: Transaction) {
    const query = {
      include: [
        {
          model: VideoModel.unscoped(),
          required: true,
          include: [
            {
              model: VideoStreamingPlaylistModel.unscoped(),
              required: true,
              where: {
                id: streamingPlaylistId
              }
            }
          ]
        }
      ],
      transaction
    }

    return VideoFileModel.findAll(query)
  }

  static getStats () {
    const webVideoFilesQuery: FindOptions = {
      include: [
        {
          attributes: [],
          required: true,
          model: VideoModel.unscoped(),
          where: {
            remote: false
          }
        }
      ]
    }

    const hlsFilesQuery: FindOptions = {
      include: [
        {
          attributes: [],
          required: true,
          model: VideoStreamingPlaylistModel.unscoped(),
          include: [
            {
              attributes: [],
              model: VideoModel.unscoped(),
              required: true,
              where: {
                remote: false
              }
            }
          ]
        }
      ]
    }

    return Promise.all([
      VideoFileModel.aggregate('size', 'SUM', webVideoFilesQuery),
      VideoFileModel.aggregate('size', 'SUM', hlsFilesQuery)
    ]).then(([ webVideoResult, hlsResult ]) => ({
      totalLocalVideoFilesSize: parseAggregateResult(webVideoResult) + parseAggregateResult(hlsResult)
    }))
  }

  // Redefine upsert because sequelize does not use an appropriate where clause in the update query with 2 unique indexes
  static async customUpsert (
    videoFile: MVideoFile,
    mode: 'streaming-playlist' | 'video',
    transaction: Transaction
  ) {
    const baseFind = {
      fps: videoFile.fps,
      resolution: videoFile.resolution,
      transaction
    }

    const element = mode === 'streaming-playlist'
      ? await VideoFileModel.loadHLSFile({ ...baseFind, playlistId: videoFile.videoStreamingPlaylistId })
      : await VideoFileModel.loadWebVideoFile({ ...baseFind, videoId: videoFile.videoId })

    if (!element) return videoFile.save({ transaction })

    for (const k of Object.keys(videoFile.toJSON())) {
      element.set(k, videoFile[k])
    }

    return element.save({ transaction })
  }

  static async loadWebVideoFile (options: {
    videoId: number
    fps: number
    resolution: number
    transaction?: Transaction
  }) {
    const where = {
      fps: options.fps,
      resolution: options.resolution,
      videoId: options.videoId
    }

    return VideoFileModel.findOne({ where, transaction: options.transaction })
  }

  static async loadHLSFile (options: {
    playlistId: number
    fps: number
    resolution: number
    transaction?: Transaction
  }) {
    const where = {
      fps: options.fps,
      resolution: options.resolution,
      videoStreamingPlaylistId: options.playlistId
    }

    return VideoFileModel.findOne({ where, transaction: options.transaction })
  }

  static removeHLSFilesOfStreamingPlaylistId (videoStreamingPlaylistId: number) {
    const options = {
      where: { videoStreamingPlaylistId }
    }

    return VideoFileModel.destroy(options)
  }

  hasTorrent () {
    return this.infoHash && this.torrentFilename
  }

  getVideoOrStreamingPlaylist (this: MVideoFileVideo | MVideoFileStreamingPlaylistVideo): MVideo | MStreamingPlaylistVideo {
    if (this.videoId || (this as MVideoFileVideo).Video) return (this as MVideoFileVideo).Video

    return (this as MVideoFileStreamingPlaylistVideo).VideoStreamingPlaylist
  }

  getVideo (this: MVideoFileVideo | MVideoFileStreamingPlaylistVideo): MVideo {
    return extractVideo(this.getVideoOrStreamingPlaylist())
  }

  isAudio () {
    return this.resolution === VideoResolution.H_NOVIDEO
  }

  isLive () {
    return this.size === -1
  }

  isHLS () {
    return !!this.videoStreamingPlaylistId
  }

  // ---------------------------------------------------------------------------

  getObjectStorageUrl (video: MVideo) {
    if (video.hasPrivateStaticPath() && CONFIG.OBJECT_STORAGE.PROXY.PROXIFY_PRIVATE_FILES === true) {
      return this.getPrivateObjectStorageUrl(video)
    }

    return this.getPublicObjectStorageUrl()
  }

  private getPrivateObjectStorageUrl (video: MVideo) {
    if (this.isHLS()) {
      return getHLSPrivateFileUrl(video, this.filename)
    }

    return getWebVideoPrivateFileUrl(this.filename)
  }

  private getPublicObjectStorageUrl () {
    if (this.isHLS()) {
      return getObjectStoragePublicFileUrl(this.fileUrl, CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
    }

    return getObjectStoragePublicFileUrl(this.fileUrl, CONFIG.OBJECT_STORAGE.WEB_VIDEOS)
  }

  // ---------------------------------------------------------------------------

  getFileUrl (video: MVideo) {
    if (video.isOwned()) {
      if (this.storage === FileStorage.OBJECT_STORAGE) {
        return this.getObjectStorageUrl(video)
      }

      return WEBSERVER.URL + this.getFileStaticPath(video)
    }

    return this.fileUrl
  }

  // ---------------------------------------------------------------------------

  getFileStaticPath (video: MVideo) {
    if (this.isHLS()) return this.getHLSFileStaticPath(video)

    return this.getWebVideoFileStaticPath(video)
  }

  private getWebVideoFileStaticPath (video: MVideo) {
    if (isVideoInPrivateDirectory(video.privacy)) {
      return join(STATIC_PATHS.PRIVATE_WEB_VIDEOS, this.filename)
    }

    return join(STATIC_PATHS.WEB_VIDEOS, this.filename)
  }

  private getHLSFileStaticPath (video: MVideo) {
    if (isVideoInPrivateDirectory(video.privacy)) {
      return join(STATIC_PATHS.STREAMING_PLAYLISTS.PRIVATE_HLS, video.uuid, this.filename)
    }

    return join(STATIC_PATHS.STREAMING_PLAYLISTS.HLS, video.uuid, this.filename)
  }

  // ---------------------------------------------------------------------------

  getFileDownloadUrl (video: MVideoWithHost) {
    const path = this.isHLS()
      ? join(STATIC_DOWNLOAD_PATHS.HLS_VIDEOS, `${video.uuid}-${this.resolution}-fragmented${this.extname}`)
      : join(STATIC_DOWNLOAD_PATHS.VIDEOS, `${video.uuid}-${this.resolution}${this.extname}`)

    if (video.isOwned()) return WEBSERVER.URL + path

    // FIXME: don't guess remote URL
    return buildRemoteUrl(video, path)
  }

  getRemoteTorrentUrl (video: MVideo) {
    if (video.isOwned()) throw new Error(`Video ${video.url} is not a remote video`)

    return this.torrentUrl
  }

  // We proxify torrent requests so use a local URL
  getTorrentUrl () {
    if (!this.torrentFilename) return null

    return WEBSERVER.URL + this.getTorrentStaticPath()
  }

  getTorrentStaticPath () {
    if (!this.torrentFilename) return null

    return join(LAZY_STATIC_PATHS.TORRENTS, this.torrentFilename)
  }

  getTorrentDownloadUrl () {
    if (!this.torrentFilename) return null

    return WEBSERVER.URL + join(STATIC_DOWNLOAD_PATHS.TORRENTS, this.torrentFilename)
  }

  removeTorrent () {
    if (!this.torrentFilename) return null

    const torrentPath = getFSTorrentFilePath(this)
    return remove(torrentPath)
      .catch(err => logger.warn('Cannot delete torrent %s.', torrentPath, { err }))
  }

  hasSameUniqueKeysThan (other: MVideoFile) {
    return this.fps === other.fps &&
      this.resolution === other.resolution &&
      (
        (this.videoId !== null && this.videoId === other.videoId) ||
        (this.videoStreamingPlaylistId !== null && this.videoStreamingPlaylistId === other.videoStreamingPlaylistId)
      )
  }

  withVideoOrPlaylist (videoOrPlaylist: MVideo | MStreamingPlaylistVideo) {
    if (isStreamingPlaylist(videoOrPlaylist)) return Object.assign(this, { VideoStreamingPlaylist: videoOrPlaylist })

    return Object.assign(this, { Video: videoOrPlaylist })
  }

  // ---------------------------------------------------------------------------

  toActivityPubObject (this: MVideoFile, video: MVideo): ActivityVideoUrlObject {
    const mimeType = getVideoFileMimeType(this.extname, false)

    return {
      type: 'Link',
      mediaType: mimeType as ActivityVideoUrlObject['mediaType'],
      href: this.getFileUrl(video),
      height: this.height || this.resolution,
      width: this.width,
      size: this.size,
      fps: this.fps
    }
  }
}
