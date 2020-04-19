import {
  AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, Is, Model, Table, UpdatedAt, Scopes
} from 'sequelize-typescript'
import { VideoAbuseObject } from '../../../shared/models/activitypub/objects'
import { VideoAbuse } from '../../../shared/models/videos'
import {
  isVideoAbuseModerationCommentValid,
  isVideoAbuseReasonValid,
  isVideoAbuseStateValid
} from '../../helpers/custom-validators/video-abuses'
import { AccountModel } from '../account/account'
import { buildBlockedAccountSQL, getSort, throwIfNotValid, searchAttribute } from '../utils'
import { VideoModel } from './video'
import { VideoAbuseState, VideoDetails } from '../../../shared'
import { CONSTRAINTS_FIELDS, VIDEO_ABUSE_STATES } from '../../initializers/constants'
import { MUserAccountId, MVideoAbuse, MVideoAbuseFormattable, MVideoAbuseVideo } from '../../typings/models'
import * as Bluebird from 'bluebird'
import { literal, Op } from 'sequelize'
import { ThumbnailModel } from './thumbnail'
import { VideoBlacklistModel } from './video-blacklist'
import { ScopeNames as VideoChannelScopeNames, SummaryOptions, VideoChannelModel } from './video-channel'

export enum ScopeNames {
  FOR_API = 'FOR_API'
}

@Scopes(() => ({
  [ScopeNames.FOR_API]: (options: {
    search?: string
    searchReporter?: string
    searchVideo?: string
    searchVideoChannel?: string
    serverAccountId: number
    userAccountId: any
  }) => {
    let where = {
      reporterAccountId: {
        [Op.notIn]: literal('(' + buildBlockedAccountSQL(options.serverAccountId, options.userAccountId) + ')')
      }
    }

    if (options.search) {
      where = Object.assign(where, {
        [Op.or]: [
          {
            [Op.and]: [
              { videoId: { [Op.not]: null } },
              { '$Video.name$': { [Op.iLike]: `%${options.search}%` } }
            ]
          },
          {
            [Op.and]: [
              { videoId: { [Op.not]: null } },
              { '$Video.VideoChannel.name$': { [Op.iLike]: `%${options.search}%` } }
            ]
          },
          {
            [Op.and]: [
              { deletedVideo: { [Op.not]: null } },
              { deletedVideo: { name: { [Op.iLike]: `%${options.search}%` } } }
            ]
          },
          {
            [Op.and]: [
              { deletedVideo: { [Op.not]: null } },
              { deletedVideo: { channel: { displayName: { [Op.iLike]: `%${options.search}%` } } } }
            ]
          },
          { '$Account.name$': { [Op.iLike]: `%${options.search}%` } }
        ]
      })
    }

    return {
      attributes: {
        include: [
          [
            literal(
              '(' +
                'SELECT t.count ' +
                'FROM ( ' +
                  'SELECT id, ' +
                         'count(id) OVER (PARTITION BY "videoId") ' +
                  'FROM "videoAbuse" ' +
                ') t ' +
                'WHERE t.id = "VideoAbuseModel".id ' +
              ')'
            ),
            'countReportsForVideo'
          ],
          [
            literal(
              '(' +
                'SELECT t.nth ' +
                'FROM ( ' +
                  'SELECT id, ' +
                         'row_number() OVER (PARTITION BY "videoId" ORDER BY "createdAt") AS nth ' +
                  'FROM "videoAbuse" ' +
                ') t ' +
                'WHERE t.id = "VideoAbuseModel".id ' +
              ')'
            ),
            'nthReportForVideo'
          ],
          [
            literal(
              '(' +
                'SELECT count("videoAbuse"."id") ' +
                'FROM "videoAbuse" ' +
                'INNER JOIN "video" ON "video"."id" = "videoAbuse"."videoId" ' +
                'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
                'INNER JOIN "account" ON "videoChannel"."accountId" = "account"."id" ' +
                'WHERE "account"."id" = "VideoAbuseModel"."reporterAccountId" ' +
              ')'
            ),
            'countReportsForReporter'
          ],
          [
            literal(
              '(' +
                'WITH ' +
                  'ids AS ( ' +
                    'SELECT "account"."id" ' +
                    'FROM "account" ' +
                    'INNER JOIN "videoChannel" ON "videoChannel"."accountId" = "account"."id" ' +
                    'INNER JOIN "video" ON "video"."channelId" = "videoChannel"."id" ' +
                    'WHERE "video"."id" = "VideoAbuseModel"."videoId" ' +
                  ') ' +
                'SELECT count("videoAbuse"."id") ' +
                'FROM "videoAbuse" ' +
                'INNER JOIN "video" ON "video"."id" = "videoAbuse"."videoId" ' +
                'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
                'INNER JOIN "account" ON "videoChannel"."accountId" = "account"."id" ' +
                'INNER JOIN ids ON "account"."id" = ids.id ' +
              ')'
            ),
            'countReportsForReportee'
          ]
        ]
      },
      include: [
        {
          model: AccountModel,
          required: true,
          where: { ...searchAttribute(options.searchReporter, 'name') }
        },
        {
          model: VideoModel,
          required: false,
          where: { ...searchAttribute(options.searchVideo, 'name') },
          include: [
            {
              model: ThumbnailModel
            },
            {
              model: VideoChannelModel.scope({ method: [ VideoChannelScopeNames.SUMMARY, { withAccount: true } as SummaryOptions ] }),
              where: { ...searchAttribute(options.searchVideoChannel, 'name') }
            },
            {
              attributes: [ 'id', 'reason', 'unfederated' ],
              model: VideoBlacklistModel
            }
          ]
        }
      ],
      where
    }
  }
}))
@Table({
  tableName: 'videoAbuse',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'reporterAccountId' ]
    }
  ]
})
export class VideoAbuseModel extends Model<VideoAbuseModel> {

  @AllowNull(false)
  @Default(null)
  @Is('VideoAbuseReason', value => throwIfNotValid(value, isVideoAbuseReasonValid, 'reason'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_ABUSES.REASON.max))
  reason: string

  @AllowNull(false)
  @Default(null)
  @Is('VideoAbuseState', value => throwIfNotValid(value, isVideoAbuseStateValid, 'state'))
  @Column
  state: VideoAbuseState

  @AllowNull(true)
  @Default(null)
  @Is('VideoAbuseModerationComment', value => throwIfNotValid(value, isVideoAbuseModerationCommentValid, 'moderationComment', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_ABUSES.MODERATION_COMMENT.max))
  moderationComment: string

  @AllowNull(true)
  @Default(null)
  @Column(DataType.JSONB)
  deletedVideo: VideoDetails

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => AccountModel)
  @Column
  reporterAccountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  Account: AccountModel

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

  static loadByIdAndVideoId (id: number, videoId?: number, uuid?: string): Bluebird<MVideoAbuse> {
    const videoAttributes = {}
    if (videoId) videoAttributes['videoId'] = videoId
    if (uuid) videoAttributes['deletedVideo'] = { uuid }

    const query = {
      where: {
        id,
        ...videoAttributes
      }
    }
    return VideoAbuseModel.findOne(query)
  }

  static listForApi (parameters: {
    start: number
    count: number
    sort: string
    search?: string
    serverAccountId: number
    user?: MUserAccountId
  }) {
    const { start, count, sort, search, user, serverAccountId } = parameters
    const userAccountId = user ? user.Account.id : undefined

    const query = {
      offset: start,
      limit: count,
      order: getSort(sort),
      col: 'VideoAbuseModel.id',
      distinct: true
    }

    const filters = {
      search,
      serverAccountId,
      userAccountId
    }

    return VideoAbuseModel
      .scope({ method: [ ScopeNames.FOR_API, filters ] })
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  toFormattedJSON (this: MVideoAbuseFormattable): VideoAbuse {
    const countReportsForVideo = this.get('countReportsForVideo') as number
    const nthReportForVideo = this.get('nthReportForVideo') as number
    const countReportsForReporter = this.get('countReportsForReporter') as number
    const countReportsForReportee = this.get('countReportsForReportee') as number

    const video = this.Video
      ? this.Video
      : this.deletedVideo

    return {
      id: this.id,
      reason: this.reason,
      reporterAccount: this.Account.toFormattedJSON(),
      state: {
        id: this.state,
        label: VideoAbuseModel.getStateLabel(this.state)
      },
      moderationComment: this.moderationComment,
      video: {
        id: video.id,
        uuid: video.uuid,
        name: video.name,
        nsfw: video.nsfw,
        deleted: !this.Video,
        blacklisted: this.Video && this.Video.isBlacklisted(),
        thumbnailPath: this.Video?.getMiniatureStaticPath(),
        channel: this.Video?.VideoChannel.toFormattedJSON() || this.deletedVideo?.channel
      },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      count: countReportsForVideo || 0,
      nth: nthReportForVideo || 0,
      countReportsForReporter: countReportsForReporter || 0,
      countReportsForReportee: countReportsForReportee || 0
    }
  }

  toActivityPubObject (this: MVideoAbuseVideo): VideoAbuseObject {
    return {
      type: 'Flag' as 'Flag',
      content: this.reason,
      object: this.Video.url
    }
  }

  private static getStateLabel (id: number) {
    return VIDEO_ABUSE_STATES[id] || 'Unknown'
  }
}
