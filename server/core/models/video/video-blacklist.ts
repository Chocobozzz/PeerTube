import { VideoBlacklist, type VideoBlacklistType_Type } from '@peertube/peertube-models'
import { MVideoBlacklist, MVideoBlacklistFormattable } from '@server/types/models/index.js'
import { FindOptions } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, Is, Table, UpdatedAt } from 'sequelize-typescript'
import { isVideoBlacklistReasonValid, isVideoBlacklistTypeValid } from '../../helpers/custom-validators/video-blacklist.js'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants.js'
import { SequelizeModel, getBlacklistSort, searchAttribute, throwIfNotValid } from '../shared/index.js'
import { ThumbnailModel } from './thumbnail.js'
import { SummaryOptions, VideoChannelModel, ScopeNames as VideoChannelScopeNames } from './video-channel.js'
import { VideoModel } from './video.js'

@Table({
  tableName: 'videoBlacklist',
  indexes: [
    {
      fields: [ 'videoId' ],
      unique: true
    }
  ]
})
export class VideoBlacklistModel extends SequelizeModel<VideoBlacklistModel> {

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
  type: VideoBlacklistType_Type

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
  Video: Awaited<VideoModel>

  static listForApi (parameters: {
    start: number
    count: number
    sort: string
    search?: string
    type?: VideoBlacklistType_Type
  }) {
    const { start, count, sort, search, type } = parameters

    function buildBaseQuery (): FindOptions {
      return {
        offset: start,
        limit: count,
        order: getBlacklistSort(sort)
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

  static loadByVideoId (id: number): Promise<MVideoBlacklist> {
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
