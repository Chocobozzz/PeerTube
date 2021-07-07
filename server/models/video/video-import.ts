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
import { afterCommitIfTransaction } from '@server/helpers/database-utils'
import { MVideoImportDefault, MVideoImportFormattable } from '@server/types/models/video/video-import'
import { AttributesOnly } from '@shared/core-utils'
import { VideoImport, VideoImportState } from '../../../shared'
import { isVideoImportStateValid, isVideoImportTargetUrlValid } from '../../helpers/custom-validators/video-imports'
import { isVideoMagnetUriValid } from '../../helpers/custom-validators/videos'
import { CONSTRAINTS_FIELDS, VIDEO_IMPORT_STATES } from '../../initializers/constants'
import { UserModel } from '../user/user'
import { getSort, throwIfNotValid } from '../utils'
import { ScopeNames as VideoModelScopeNames, VideoModel } from './video'

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
export class VideoImportModel extends Model<Partial<AttributesOnly<VideoImportModel>>> {
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
      return afterCommitIfTransaction(options.transaction, () => instance.Video.destroy())
    }

    return undefined
  }

  static loadAndPopulateVideo (id: number): Promise<MVideoImportDefault> {
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
