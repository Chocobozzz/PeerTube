import {
  AfterCreate,
  AfterDestroy,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Is,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { getSortOnModel, SortType, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { isVideoBlacklistReasonValid } from '../../helpers/custom-validators/video-blacklist'
import { Emailer } from '../../lib/emailer'
import { VideoBlacklist } from '../../../shared/models/videos'
import { CONSTRAINTS_FIELDS } from '../../initializers'

@Table({
  tableName: 'videoBlacklist',
  indexes: [
    {
      fields: [ 'videoId' ],
      unique: true
    }
  ]
})
export class VideoBlacklistModel extends Model<VideoBlacklistModel> {

  @AllowNull(true)
  @Is('VideoBlacklistReason', value => throwIfNotValid(value, isVideoBlacklistReasonValid, 'reason'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_BLACKLIST.REASON.max))
  reason: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Video: VideoModel

  @AfterCreate
  static sendBlacklistEmailNotification (instance: VideoBlacklistModel) {
    return Emailer.Instance.addVideoBlacklistReportJob(instance.videoId, instance.reason)
  }

  @AfterDestroy
  static sendUnblacklistEmailNotification (instance: VideoBlacklistModel) {
    return Emailer.Instance.addVideoUnblacklistReportJob(instance.videoId)
  }

  static listForApi (start: number, count: number, sort: SortType) {
    const query = {
      offset: start,
      limit: count,
      order: getSortOnModel(sort.sortModel, sort.sortValue),
      include: [
        {
          model: VideoModel,
          required: true
        }
      ]
    }

    return VideoBlacklistModel.findAndCountAll(query)
      .then(({ rows, count }) => {
        return {
          data: rows,
          total: count
        }
      })
  }

  static loadByVideoId (id: number) {
    const query = {
      where: {
        videoId: id
      }
    }

    return VideoBlacklistModel.findOne(query)
  }

  toFormattedJSON (): VideoBlacklist {
    const video = this.Video

    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      reason: this.reason,

      video: {
        id: video.id,
        name: video.name,
        uuid: video.uuid,
        description: video.description,
        duration: video.duration,
        views: video.views,
        likes: video.likes,
        dislikes: video.dislikes,
        nsfw: video.nsfw
      }
    }
  }
}
