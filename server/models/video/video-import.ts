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
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { CONSTRAINTS_FIELDS } from '../../initializers'
import { throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { isVideoImportStateValid, isVideoImportTargetUrlValid } from '../../helpers/custom-validators/video-imports'
import { VideoImport, VideoImportState } from '../../../shared'
import { VideoChannelModel } from './video-channel'
import { AccountModel } from '../account/account'

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
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Video: VideoModel

  static loadAndPopulateVideo (id: number) {
    return VideoImportModel.findById(id)
  }

  toFormattedJSON (): VideoImport {
    const videoFormatOptions = {
      additionalAttributes: { state: true, waitTranscoding: true, scheduledUpdate: true }
    }
    const video = Object.assign(this.Video.toFormattedJSON(videoFormatOptions), {
      tags: this.Video.Tags.map(t => t.name)
    })

    return {
      targetUrl: this.targetUrl,
      video
    }
  }
}
