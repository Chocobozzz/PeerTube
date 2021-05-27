import { remove } from 'fs-extra'
import * as memoizee from 'memoizee'
import { join } from 'path'
import { FindOptions, Op, QueryTypes, Transaction } from 'sequelize'
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
  Is,
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { Where } from 'sequelize/types/lib/utils'
import validator from 'validator'
import { buildRemoteVideoBaseUrl } from '@server/helpers/activitypub'
import { logger } from '@server/helpers/logger'
import { extractVideo } from '@server/helpers/video'
import { getTorrentFilePath } from '@server/lib/video-paths'
import { MStreamingPlaylistVideo, MVideo, MVideoWithHost } from '@server/types/models'
import { AttributesOnly } from '@shared/core-utils'
import {
  isVideoFileExtnameValid,
  isVideoFileInfoHashValid,
  isVideoFileResolutionValid,
  isVideoFileSizeValid,
  isVideoFPSResolutionValid
} from '../../helpers/custom-validators/videos'
import {
  LAZY_STATIC_PATHS,
  MEMOIZE_LENGTH,
  MEMOIZE_TTL,
  MIMETYPES,
  STATIC_DOWNLOAD_PATHS,
  STATIC_PATHS,
  WEBSERVER
} from '../../initializers/constants'
import { MVideoFile, MVideoFileStreamingPlaylistVideo, MVideoFileVideo } from '../../types/models/video/video-file'
import { VideoRedundancyModel } from '../redundancy/video-redundancy'
import { parseAggregateResult, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { VideoStreamingPlaylistModel } from './video-streaming-playlist'

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
  [ScopeNames.WITH_VIDEO_OR_PLAYLIST]: (options: { whereVideo?: Where } = {}) => {
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
export class VideoFileModel extends Model<Partial<AttributesOnly<VideoFileModel>>> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Is('VideoFileResolution', value => throwIfNotValid(value, isVideoFileResolutionValid, 'resolution'))
  @Column
  resolution: number

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

  @AllowNull(true)
  @Column
  fileUrl: string

  // Could be null for live files
  @AllowNull(true)
  @Column
  filename: string

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

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  Video: VideoModel

  @ForeignKey(() => VideoStreamingPlaylistModel)
  @Column
  videoStreamingPlaylistId: number

  @BelongsTo(() => VideoStreamingPlaylistModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  VideoStreamingPlaylist: VideoStreamingPlaylistModel

  @HasMany(() => VideoRedundancyModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  RedundancyVideos: VideoRedundancyModel[]

  static doesInfohashExistCached = memoizee(VideoFileModel.doesInfohashExist, {
    promise: true,
    max: MEMOIZE_LENGTH.INFO_HASH_EXISTS,
    maxAge: MEMOIZE_TTL.INFO_HASH_EXISTS
  })

  static doesInfohashExist (infoHash: string) {
    const query = 'SELECT 1 FROM "videoFile" WHERE "infoHash" = $infoHash LIMIT 1'
    const options = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      bind: { infoHash },
      raw: true
    }

    return VideoModel.sequelize.query(query, options)
              .then(results => results.length === 1)
  }

  static async doesVideoExistForVideoFile (id: number, videoIdOrUUID: number | string) {
    const videoFile = await VideoFileModel.loadWithVideoOrPlaylist(id, videoIdOrUUID)

    return !!videoFile
  }

  static loadWithVideoOrPlaylistByTorrentFilename (filename: string) {
    const query = {
      where: {
        torrentFilename: filename
      }
    }

    return VideoFileModel.scope(ScopeNames.WITH_VIDEO_OR_PLAYLIST).findOne(query)
  }

  static loadWithMetadata (id: number) {
    return VideoFileModel.scope(ScopeNames.WITH_METADATA).findByPk(id)
  }

  static loadWithVideo (id: number) {
    return VideoFileModel.scope(ScopeNames.WITH_VIDEO).findByPk(id)
  }

  static loadWithVideoOrPlaylist (id: number, videoIdOrUUID: number | string) {
    const whereVideo = validator.isUUID(videoIdOrUUID + '')
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
    const webtorrentFilesQuery: FindOptions = {
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
      VideoFileModel.aggregate('size', 'SUM', webtorrentFilesQuery),
      VideoFileModel.aggregate('size', 'SUM', hlsFilesQuery)
    ]).then(([ webtorrentResult, hlsResult ]) => ({
      totalLocalVideoFilesSize: parseAggregateResult(webtorrentResult) + parseAggregateResult(hlsResult)
    }))
  }

  // Redefine upsert because sequelize does not use an appropriate where clause in the update query with 2 unique indexes
  static async customUpsert (
    videoFile: MVideoFile,
    mode: 'streaming-playlist' | 'video',
    transaction: Transaction
  ) {
    const baseWhere = {
      fps: videoFile.fps,
      resolution: videoFile.resolution
    }

    if (mode === 'streaming-playlist') Object.assign(baseWhere, { videoStreamingPlaylistId: videoFile.videoStreamingPlaylistId })
    else Object.assign(baseWhere, { videoId: videoFile.videoId })

    const element = await VideoFileModel.findOne({ where: baseWhere, transaction })
    if (!element) return videoFile.save({ transaction })

    for (const k of Object.keys(videoFile.toJSON())) {
      element[k] = videoFile[k]
    }

    return element.save({ transaction })
  }

  static removeHLSFilesOfVideoId (videoStreamingPlaylistId: number) {
    const options = {
      where: { videoStreamingPlaylistId }
    }

    return VideoFileModel.destroy(options)
  }

  hasTorrent () {
    return this.infoHash && this.torrentFilename
  }

  getVideoOrStreamingPlaylist (this: MVideoFileVideo | MVideoFileStreamingPlaylistVideo): MVideo | MStreamingPlaylistVideo {
    if (this.videoId) return (this as MVideoFileVideo).Video

    return (this as MVideoFileStreamingPlaylistVideo).VideoStreamingPlaylist
  }

  getVideo (this: MVideoFileVideo | MVideoFileStreamingPlaylistVideo): MVideo {
    return extractVideo(this.getVideoOrStreamingPlaylist())
  }

  isAudio () {
    return !!MIMETYPES.AUDIO.EXT_MIMETYPE[this.extname]
  }

  isLive () {
    return this.size === -1
  }

  isHLS () {
    return !!this.videoStreamingPlaylistId
  }

  getFileUrl (video: MVideo) {
    if (!this.Video) this.Video = video as VideoModel

    if (video.isOwned()) return WEBSERVER.URL + this.getFileStaticPath(video)

    return this.fileUrl
  }

  getFileStaticPath (video: MVideo) {
    if (this.isHLS()) return join(STATIC_PATHS.STREAMING_PLAYLISTS.HLS, video.uuid, this.filename)

    return join(STATIC_PATHS.WEBSEED, this.filename)
  }

  getFileDownloadUrl (video: MVideoWithHost) {
    const basePath = this.isHLS()
      ? STATIC_DOWNLOAD_PATHS.HLS_VIDEOS
      : STATIC_DOWNLOAD_PATHS.VIDEOS
    const path = join(basePath, this.filename)

    if (video.isOwned()) return WEBSERVER.URL + path

    // FIXME: don't guess remote URL
    return buildRemoteVideoBaseUrl(video, path)
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

    const torrentPath = getTorrentFilePath(this)
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
}
