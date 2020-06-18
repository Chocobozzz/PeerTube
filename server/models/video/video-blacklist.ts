import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { getBlacklistSort, SortType, throwIfNotValid, searchAttribute } from '../utils'
import { VideoModel } from './video'
import { ScopeNames as VideoChannelScopeNames, SummaryOptions, VideoChannelModel } from './video-channel'
import { isVideoBlacklistReasonValid, isVideoBlacklistTypeValid } from '../../helpers/custom-validators/video-blacklist'
import { VideoBlacklist, VideoBlacklistType } from '../../../shared/models/videos'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { FindOptions } from 'sequelize'
import { ThumbnailModel } from './thumbnail'
import * as Bluebird from 'bluebird'
import { MVideoBlacklist, MVideoBlacklistFormattable } from '@server/types/models'

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

  static listForApi (parameters: {
    start: number
    count: number
    sort: SortType
    search?: string
    type?: VideoBlacklistType
  }) {
    const { start, count, sort, search, type } = parameters

    function buildBaseQuery (): FindOptions {
      return {
        offset: start,
        limit: count,
        order: getBlacklistSort(sort.sortModel, sort.sortValue)
      }
    }

    const countQuery = buildBaseQuery()

    const findQuery = buildBaseQuery()
    findQuery.include = [
      {
        model: VideoModel,
        required: true,
        where: searchAttribute(search, 'name'),
        include: [
          {
            model: VideoChannelModel.scope({ method: [ VideoChannelScopeNames.SUMMARY, { withAccount: true } as SummaryOptions ] }),
            required: true
          },
          {
            model: ThumbnailModel,
            attributes: [ 'type', 'filename' ],
            required: false
          }
        ]
      }
    ]

    if (type) {
      countQuery.where = { type }
      findQuery.where = { type }
    }

    return Promise.all([
      VideoBlacklistModel.count(countQuery),
      VideoBlacklistModel.findAll(findQuery)
    ]).then(([ count, rows ]) => {
      return {
        data: rows,
        total: count
      }
    })
  }

  static loadByVideoId (id: number): Bluebird<MVideoBlacklist> {
    const query = {
      where: {
        videoId: id
      }
    }

    return VideoBlacklistModel.findOne(query)
  }

  toFormattedJSON (this: MVideoBlacklistFormattable): VideoBlacklist {
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
