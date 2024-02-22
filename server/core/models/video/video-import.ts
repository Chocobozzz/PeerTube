import { VideoImport, VideoImportState, type VideoImportStateType } from '@peertube/peertube-models'
import { afterCommitIfTransaction } from '@server/helpers/database-utils.js'
import { MVideoImportDefault, MVideoImportFormattable } from '@server/types/models/video/video-import.js'
import { IncludeOptions, Op, WhereOptions } from 'sequelize'
import {
  AfterUpdate,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DefaultScope,
  ForeignKey,
  Is, Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isVideoImportStateValid, isVideoImportTargetUrlValid } from '../../helpers/custom-validators/video-imports.js'
import { isVideoMagnetUriValid } from '../../helpers/custom-validators/videos.js'
import { CONSTRAINTS_FIELDS, VIDEO_IMPORT_STATES } from '../../initializers/constants.js'
import { SequelizeModel, getSort, searchAttribute, throwIfNotValid } from '../shared/index.js'
import { UserModel } from '../user/user.js'
import { VideoChannelSyncModel } from './video-channel-sync.js'
import { VideoModel, ScopeNames as VideoModelScopeNames } from './video.js'

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
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(true)
  @Default(null)
  @Is('VideoImportTargetUrl', value => throwIfNotValid(value, isVideoImportTargetUrlValid, 'targetUrl', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_IMPORTS.URL.max))
  targetUrl: string

  @AllowNull(true)
  @Default(null)
  @Is('VideoImportMagnetUri', value => throwIfNotValid(value, isVideoMagnetUriValid, 'magnetUri', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_IMPORTS.URL.max)) // Use the same constraints than URLs
  magnetUri: string

  @AllowNull(true)
  @Default(null)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_IMPORTS.TORRENT_NAME.max))
  torrentName: string

  @AllowNull(false)
  @Default(null)
  @Is('VideoImportState', value => throwIfNotValid(value, isVideoImportStateValid, 'state'))
  @Column
  state: VideoImportStateType

  @AllowNull(true)
  @Default(null)
  @Column(DataType.TEXT)
  error: string

  @ForeignKey(() => UserModel)
  @Column
  userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  User: Awaited<UserModel>

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  Video: Awaited<VideoModel>

  @ForeignKey(() => VideoChannelSyncModel)
  @Column
  videoChannelSyncId: number

  @BelongsTo(() => VideoChannelSyncModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  VideoChannelSync: Awaited<VideoChannelSyncModel>

  @AfterUpdate
  static deleteVideoIfFailed (instance: VideoImportModel, options) {
    if (instance.state === VideoImportState.FAILED) {
      return afterCommitIfTransaction(options.transaction, () => instance.Video.destroy())
    }

    return undefined
  }

  static loadAndPopulateVideo (id: number): Promise<MVideoImportDefault> {
    return VideoImportModel.findByPk(id)
  }

  static listUserVideoImportsForApi (options: {
    userId: number
    start: number
    count: number
    sort: string

    search?: string
    targetUrl?: string
    videoChannelSyncId?: number
  }) {
    const { userId, start, count, sort, targetUrl, videoChannelSyncId, search } = options

    const where: WhereOptions = [ { userId } ]
    const include: IncludeOptions[] = [
      {
        attributes: [ 'id' ],
        model: UserModel.unscoped(), // FIXME: Without this, sequelize try to COUNT(DISTINCT(*)) which is an invalid SQL query
        required: true
      },
      {
        model: VideoChannelSyncModel.unscoped(),
        required: false
      }
    ]

    if (targetUrl) where.push({ targetUrl })
    if (videoChannelSyncId) where.push({ videoChannelSyncId })

    if (search) {
      include.push({
        model: defaultVideoScope(),
        required: false
      })

      where.push({
        [Op.or]: [
          searchAttribute(search, '$Video.name$'),
          searchAttribute(search, 'targetUrl'),
          searchAttribute(search, 'torrentName'),
          searchAttribute(search, 'magnetUri')
        ]
      })
    } else {
      include.push({
        model: defaultVideoScope(),
        required: false
      })
    }

    const query = {
      distinct: true,
      include,
      offset: start,
      limit: count,
      order: getSort(sort),
      where
    }

    return Promise.all([
      VideoImportModel.unscoped().count(query),
      VideoImportModel.findAll<MVideoImportDefault>(query)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static async urlAlreadyImported (channelId: number, targetUrl: string): Promise<boolean> {
    const element = await VideoImportModel.unscoped().findOne({
      where: {
        targetUrl,
        state: {
          [Op.in]: [ VideoImportState.PENDING, VideoImportState.PROCESSING, VideoImportState.SUCCESS ]
        }
      },
      include: [
        {
          model: VideoModel,
          required: true,
          where: {
            channelId
          }
        }
      ]
    })

    return !!element
  }

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
