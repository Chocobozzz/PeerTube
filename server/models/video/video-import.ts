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
  Is,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { CONSTRAINTS_FIELDS, VIDEO_IMPORT_STATES } from '../../initializers/constants'
import { getSort, throwIfNotValid } from '../utils'
import { ScopeNames as VideoModelScopeNames, VideoModel } from './video'
import { isVideoImportStateValid, isVideoImportTargetUrlValid } from '../../helpers/custom-validators/video-imports'
import { VideoImport, VideoImportState } from '../../../shared'
import { isVideoMagnetUriValid } from '../../helpers/custom-validators/videos'
import { UserModel } from '../account/user'
import * as Bluebird from 'bluebird'
import { MVideoImportDefault, MVideoImportFormattable } from '@server/types/models/video/video-import'

@DefaultScope(() => ({
  include: [
    {
      model: UserModel.unscoped(),
      required: true
    },
    {
      model: VideoModel.scope([
        VideoModelScopeNames.WITH_ACCOUNT_DETAILS,
        VideoModelScopeNames.WITH_TAGS,
        VideoModelScopeNames.WITH_THUMBNAILS
      ]),
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
export class VideoImportModel extends Model<VideoImportModel> {
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
  state: VideoImportState

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
  User: UserModel

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  Video: VideoModel

  @AfterUpdate
  static deleteVideoIfFailed (instance: VideoImportModel, options) {
    if (instance.state === VideoImportState.FAILED) {
      return instance.Video.destroy({ transaction: options.transaction })
    }

    return undefined
  }

  static loadAndPopulateVideo (id: number): Bluebird<MVideoImportDefault> {
    return VideoImportModel.findByPk(id)
  }

  static listUserVideoImportsForApi (userId: number, start: number, count: number, sort: string) {
    const query = {
      distinct: true,
      include: [
        {
          attributes: [ 'id' ],
          model: UserModel.unscoped(), // FIXME: Without this, sequelize try to COUNT(DISTINCT(*)) which is an invalid SQL query
          required: true
        }
      ],
      offset: start,
      limit: count,
      order: getSort(sort),
      where: {
        userId
      }
    }

    return VideoImportModel.findAndCountAll<MVideoImportDefault>(query)
                           .then(({ rows, count }) => {
                             return {
                               data: rows,
                               total: count
                             }
                           })
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
      video
    }
  }

  private static getStateLabel (id: number) {
    return VIDEO_IMPORT_STATES[id] || 'Unknown'
  }
}
