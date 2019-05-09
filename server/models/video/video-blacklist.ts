import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { getSortOnModel, SortType, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { ScopeNames as VideoChannelScopeNames, VideoChannelModel } from './video-channel'
import { isVideoBlacklistReasonValid, isVideoBlacklistTypeValid } from '../../helpers/custom-validators/video-blacklist'
import { VideoBlacklist, VideoBlacklistType } from '../../../shared/models/videos'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { FindOptions } from 'sequelize'

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
  @Is('VideoBlacklistReason', value => throwIfNotValid(value, isVideoBlacklistReasonValid, 'reason', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_BLACKLIST.REASON.max))
  reason: string

  @AllowNull(false)
  @Column
  unfederated: boolean

  @AllowNull(false)
  @Default(null)
  @Is('VideoBlacklistType', value => throwIfNotValid(value, isVideoBlacklistTypeValid, 'type'))
  @Column
  type: VideoBlacklistType

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

  static listForApi (start: number, count: number, sort: SortType, type?: VideoBlacklistType) {
    const query: FindOptions = {
      offset: start,
      limit: count,
      order: getSortOnModel(sort.sortModel, sort.sortValue),
      include: [
        {
          model: VideoModel,
          required: true,
          include: [
            {
              model: VideoChannelModel.scope({ method: [ VideoChannelScopeNames.SUMMARY, true ] }),
              required: true
            }
          ]
        }
      ]
    }

    if (type) {
      query.where = { type }
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
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      reason: this.reason,
      unfederated: this.unfederated,
      type: this.type,

      video: this.Video.toFormattedJSON()
    }
  }
}
