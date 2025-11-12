import { VideoImport, type VideoImportPayload, VideoImportState, type VideoImportStateType } from '@peertube/peertube-models'
import { MVideoImport, MVideoImportDefault, MVideoImportFormattable } from '@server/types/models/video/video-import.js'
import { Op } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DefaultScope,
  ForeignKey,
  Is,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isVideoImportStateValid, isVideoImportTargetUrlValid } from '../../helpers/custom-validators/video-imports.js'
import { isVideoMagnetUriValid } from '../../helpers/custom-validators/videos.js'
import { CONSTRAINTS_FIELDS, VIDEO_IMPORT_STATES } from '../../initializers/constants.js'
import { buildSQLAttributes, SequelizeModel, throwIfNotValid } from '../shared/index.js'
import { UserModel } from '../user/user.js'
import { ListVideoImportsOptions, VideoImportListQueryBuilder } from './sql/import/video-import-list-query-builder.js'
import { VideoChannelSyncModel } from './video-channel-sync.js'
import { VideoModel, ScopeNames as VideoModelScopeNames } from './video.js'
import { CONFIG } from '@server/initializers/config.js'

const defaultVideoScope = () => {
  return VideoModel.scope([
    VideoModelScopeNames.WITH_ACCOUNT_DETAILS,
    VideoModelScopeNames.WITH_TAGS,
    VideoModelScopeNames.WITH_THUMBNAILS
  ])
}

@DefaultScope(() => ({
  include: [
    {
      model: UserModel.unscoped(),
      required: true
    },
    {
      model: defaultVideoScope(),
      required: false
    },
    {
      model: VideoChannelSyncModel.unscoped(),
      required: false
    }
  ]
}))
@Table({
  tableName: 'videoImport',
  indexes: [
    {
      fields: [ 'videoId' ],
      unique: true
    },
    {
      fields: [ 'userId' ]
    }
  ]
})
export class VideoImportModel extends SequelizeModel<VideoImportModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(true)
  @Default(null)
  @Is('VideoImportTargetUrl', value => throwIfNotValid(value, isVideoImportTargetUrlValid, 'targetUrl', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_IMPORTS.URL.max))
  declare targetUrl: string

  @AllowNull(true)
  @Default(null)
  @Is('VideoImportMagnetUri', value => throwIfNotValid(value, isVideoMagnetUriValid, 'magnetUri', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_IMPORTS.URL.max)) // Use the same constraints than URLs
  declare magnetUri: string

  @AllowNull(true)
  @Default(null)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_IMPORTS.TORRENT_NAME.max))
  declare torrentName: string

  @AllowNull(false)
  @Default(null)
  @Is('VideoImportState', value => throwIfNotValid(value, isVideoImportStateValid, 'state'))
  @Column
  declare state: VideoImportStateType

  @AllowNull(true)
  @Default(null)
  @Column(DataType.TEXT)
  declare error: string

  @AllowNull(false)
  @Default(0)
  @Column
  declare attempts: number

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare payload: VideoImportPayload

  @ForeignKey(() => UserModel)
  @Column
  declare userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare User: Awaited<UserModel>

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  declare Video: Awaited<VideoModel>

  @ForeignKey(() => VideoChannelSyncModel)
  @Column
  declare videoChannelSyncId: number

  @BelongsTo(() => VideoChannelSyncModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  declare VideoChannelSync: Awaited<VideoChannelSyncModel>

  // ---------------------------------------------------------------------------

  static getSQLAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix
    })
  }

  // ---------------------------------------------------------------------------

  static loadAndPopulateVideo (id: number): Promise<MVideoImportDefault> {
    return VideoImportModel.findByPk(id)
  }

  static listUserVideoImportsForApi (options: ListVideoImportsOptions) {
    return Promise.all([
      new VideoImportListQueryBuilder(VideoImportModel.sequelize, options).list<MVideoImportFormattable>(),
      new VideoImportListQueryBuilder(VideoImportModel.sequelize, options).count()
    ]).then(([ rows, count ]) => {
      return { total: count, data: rows }
    })
  }

  static async urlAlreadyImported (options: {
    targetUrl: string
    channelId: number
    channelSyncId?: number
  }): Promise<boolean> {
    const { channelSyncId, channelId, targetUrl } = options

    const baseWhere = { targetUrl }

    const bySyncId = channelSyncId
      ? VideoImportModel.unscoped().findOne({
        where: {
          ...baseWhere,

          videoChannelSyncId: channelSyncId
        }
      })
      : Promise.resolve(undefined)

    const byChannelId = VideoImportModel.unscoped().findOne({
      where: baseWhere,
      include: [
        {
          model: VideoModel.unscoped(),
          required: true,
          where: {
            channelId
          }
        }
      ]
    })

    return (await Promise.all([ bySyncId, byChannelId ])).some(e => !!e)
  }

  static listFailedBySyncId (options: {
    channelSyncId?: number
  }): Promise<MVideoImport[]> {
    return VideoImportModel.unscoped().findAll({
      include: [
        {
          model: VideoModel.unscoped(),
          required: true
        }
      ],
      where: {
        videoChannelSyncId: options.channelSyncId,
        state: {
          [Op.in]: [ VideoImportState.FAILED ]
        },
        attempts: {
          [Op.lt]: CONFIG.IMPORT.VIDEOS.MAX_ATTEMPTS
        }
      },
      limit: 100
    })
  }

  // ---------------------------------------------------------------------------

  getTargetIdentifier () {
    return this.targetUrl || this.magnetUri || this.torrentName
  }

  toFormattedJSON (this: MVideoImportFormattable): VideoImport {
    const videoFormatOptions = {
      completeDescription: true,
      additionalAttributes: { state: true, waitTranscoding: true, scheduledUpdate: true }
    }
    const video = this.Video
      ? Object.assign(this.Video.toFormattedJSON(videoFormatOptions), { tags: this.Video.Tags.map(t => t.name) })
      : undefined

    const videoChannelSync = this.VideoChannelSync
      ? { id: this.VideoChannelSync.id, externalChannelUrl: this.VideoChannelSync.externalChannelUrl }
      : undefined

    return {
      id: this.id,

      targetUrl: this.targetUrl,
      magnetUri: this.magnetUri,
      torrentName: this.torrentName,

      attempts: this.attempts,

      state: {
        id: this.state,
        label: VideoImportModel.getStateLabel(this.state)
      },
      error: this.error,
      updatedAt: this.updatedAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
      video,
      videoChannelSync
    }
  }

  private static getStateLabel (id: number) {
    return VIDEO_IMPORT_STATES[id] || 'Unknown'
  }
}
