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
import { CONSTRAINTS_FIELDS, VIDEO_IMPORT_STATES } from '../../initializers'
import { getSort, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { isVideoImportStateValid, isVideoImportTargetUrlValid } from '../../helpers/custom-validators/video-imports'
import { VideoImport, VideoImportState } from '../../../shared'
import { VideoChannelModel } from './video-channel'
import { AccountModel } from '../account/account'
import { TagModel } from './tag'

@DefaultScope({
  include: [
    {
      model: () => VideoModel,
      required: true,
      include: [
        {
          model: () => VideoChannelModel,
          required: true,
          include: [
            {
              model: () => AccountModel,
              required: true
            }
          ]
        },
        {
          model: () => TagModel,
          required: false
        }
      ]
    }
  ]
})

@Table({
  tableName: 'videoImport',
  indexes: [
    {
      fields: [ 'videoId' ],
      unique: true
    }
  ]
})
export class VideoImportModel extends Model<VideoImportModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Is('VideoImportTargetUrl', value => throwIfNotValid(value, isVideoImportTargetUrlValid, 'targetUrl'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_IMPORTS.URL.max))
  targetUrl: string

  @AllowNull(false)
  @Default(null)
  @Is('VideoImportState', value => throwIfNotValid(value, isVideoImportStateValid, 'state'))
  @Column
  state: VideoImportState

  @AllowNull(true)
  @Default(null)
  @Column(DataType.TEXT)
  error: string

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

  static loadAndPopulateVideo (id: number) {
    return VideoImportModel.findById(id)
  }

  static listUserVideoImportsForApi (accountId: number, start: number, count: number, sort: string) {
    const query = {
      offset: start,
      limit: count,
      order: getSort(sort),
      include: [
        {
          model: VideoModel,
          required: true,
          include: [
            {
              model: VideoChannelModel,
              required: true,
              include: [
                {
                  model: AccountModel,
                  required: true,
                  where: {
                    id: accountId
                  }
                }
              ]
            },
            {
              model: TagModel,
              required: false
            }
          ]
        }
      ]
    }

    return VideoImportModel.unscoped()
                           .findAndCountAll(query)
                           .then(({ rows, count }) => {
                             return {
                               data: rows,
                               total: count
                             }
                           })
  }

  toFormattedJSON (): VideoImport {
    const videoFormatOptions = {
      additionalAttributes: { state: true, waitTranscoding: true, scheduledUpdate: true }
    }
    const video = this.Video
      ? Object.assign(this.Video.toFormattedJSON(videoFormatOptions), {
        tags: this.Video.Tags.map(t => t.name)
      })
      : undefined

    return {
      targetUrl: this.targetUrl,
      state: {
        id: this.state,
        label: VideoImportModel.getStateLabel(this.state)
      },
      updatedAt: this.updatedAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
      video
    }
  }
  private static getStateLabel (id: number) {
    return VIDEO_IMPORT_STATES[id] || 'Unknown'
  }
}
