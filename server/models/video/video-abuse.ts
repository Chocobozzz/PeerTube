import * as Bluebird from 'bluebird'
import { literal, Op } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Is,
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { VideoAbuseVideoIs } from '@shared/models/videos/abuse/video-abuse-video-is.type'
import {
  VideoAbuseState,
  VideoDetails,
  VideoAbusePredefinedReasons,
  VideoAbusePredefinedReasonsString,
  videoAbusePredefinedReasonsMap
} from '../../../shared'
import { VideoAbuseObject } from '../../../shared/models/activitypub/objects'
import { VideoAbuse } from '../../../shared/models/videos'
import {
  isVideoAbuseModerationCommentValid,
  isVideoAbuseReasonValid,
  isVideoAbuseStateValid
} from '../../helpers/custom-validators/video-abuses'
import { CONSTRAINTS_FIELDS, VIDEO_ABUSE_STATES } from '../../initializers/constants'
import { MUserAccountId, MVideoAbuse, MVideoAbuseFormattable, MVideoAbuseVideo } from '../../types/models'
import { AccountModel } from '../account/account'
import { buildBlockedAccountSQL, getSort, searchAttribute, throwIfNotValid } from '../utils'
import { ThumbnailModel } from './thumbnail'
import { VideoModel } from './video'
import { VideoBlacklistModel } from './video-blacklist'
import { ScopeNames as VideoChannelScopeNames, SummaryOptions, VideoChannelModel } from './video-channel'
import { invert } from 'lodash'

export enum ScopeNames {
  FOR_API = 'FOR_API'
}

@Scopes(() => ({
  [ScopeNames.FOR_API]: (options: {
    // search
    search?: string
    searchReporter?: string
    searchReportee?: string
    searchVideo?: string
    searchVideoChannel?: string

    // filters
    id?: number
    predefinedReasonId?: number

    state?: VideoAbuseState
    videoIs?: VideoAbuseVideoIs

    // accountIds
    serverAccountId: number
    userAccountId: number
  }) => {
    const where = {
      reporterAccountId: {
        [Op.notIn]: literal('(' + buildBlockedAccountSQL([ options.serverAccountId, options.userAccountId ]) + ')')
      }
    }

    if (options.search) {
      Object.assign(where, {
        [Op.or]: [
          {
            [Op.and]: [
              { videoId: { [Op.not]: null } },
              searchAttribute(options.search, '$Video.name$')
            ]
          },
          {
            [Op.and]: [
              { videoId: { [Op.not]: null } },
              searchAttribute(options.search, '$Video.VideoChannel.name$')
            ]
          },
          {
            [Op.and]: [
              { deletedVideo: { [Op.not]: null } },
              { deletedVideo: searchAttribute(options.search, 'name') }
            ]
          },
          {
            [Op.and]: [
              { deletedVideo: { [Op.not]: null } },
              { deletedVideo: { channel: searchAttribute(options.search, 'displayName') } }
            ]
          },
          searchAttribute(options.search, '$Account.name$')
        ]
      })
    }

    if (options.id) Object.assign(where, { id: options.id })
    if (options.state) Object.assign(where, { state: options.state })

    if (options.videoIs === 'deleted') {
      Object.assign(where, {
        deletedVideo: {
          [Op.not]: null
        }
      })
    }

    if (options.predefinedReasonId) {
      Object.assign(where, {
        predefinedReasons: {
          [Op.contains]: [ options.predefinedReasonId ]
        }
      })
    }

    const onlyBlacklisted = options.videoIs === 'blacklisted'

    return {
      attributes: {
        include: [
          [
            // we don't care about this count for deleted videos, so there are not included
            literal(
              '(' +
                'SELECT count(*) ' +
                'FROM "videoAbuse" ' +
                'WHERE "videoId" = "VideoAbuseModel"."videoId" ' +
              ')'
            ),
            'countReportsForVideo'
          ],
          [
            // we don't care about this count for deleted videos, so there are not included
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
            'countReportsForReporter__video'
          ],
          [
            literal(
              '(' +
                'SELECT count(DISTINCT "videoAbuse"."id") ' +
                'FROM "videoAbuse" ' +
                `WHERE CAST("deletedVideo"->'channel'->'ownerAccount'->>'id' AS INTEGER) = "VideoAbuseModel"."reporterAccountId" ` +
              ')'
            ),
            'countReportsForReporter__deletedVideo'
          ],
          [
            literal(
              '(' +
                'SELECT count(DISTINCT "videoAbuse"."id") ' +
                'FROM "videoAbuse" ' +
                'INNER JOIN "video" ON "video"."id" = "videoAbuse"."videoId" ' +
                'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
                'INNER JOIN "account" ON ' +
                      '"videoChannel"."accountId" = "Video->VideoChannel"."accountId" ' +
                   `OR "videoChannel"."accountId" = CAST("VideoAbuseModel"."deletedVideo"->'channel'->'ownerAccount'->>'id' AS INTEGER) ` +
              ')'
            ),
            'countReportsForReportee__video'
          ],
          [
            literal(
              '(' +
                'SELECT count(DISTINCT "videoAbuse"."id") ' +
                'FROM "videoAbuse" ' +
                `WHERE CAST("deletedVideo"->'channel'->'ownerAccount'->>'id' AS INTEGER) = "Video->VideoChannel"."accountId" ` +
                   `OR CAST("deletedVideo"->'channel'->'ownerAccount'->>'id' AS INTEGER) = ` +
                      `CAST("VideoAbuseModel"."deletedVideo"->'channel'->'ownerAccount'->>'id' AS INTEGER) ` +
              ')'
            ),
            'countReportsForReportee__deletedVideo'
          ]
        ]
      },
      include: [
        {
          model: AccountModel,
          required: true,
          where: searchAttribute(options.searchReporter, 'name')
        },
        {
          model: VideoModel,
          required: !!(onlyBlacklisted || options.searchVideo || options.searchReportee || options.searchVideoChannel),
          where: searchAttribute(options.searchVideo, 'name'),
          include: [
            {
              model: ThumbnailModel
            },
            {
              model: VideoChannelModel.scope({ method: [ VideoChannelScopeNames.SUMMARY, { withAccount: true } as SummaryOptions ] }),
              where: searchAttribute(options.searchVideoChannel, 'name'),
              include: [
                {
                  model: AccountModel,
                  where: searchAttribute(options.searchReportee, 'name')
                }
              ]
            },
            {
              attributes: [ 'id', 'reason', 'unfederated' ],
              model: VideoBlacklistModel,
              required: onlyBlacklisted
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

  @AllowNull(true)
  @Default(null)
  @Column(DataType.ARRAY(DataType.INTEGER))
  predefinedReasons: VideoAbusePredefinedReasons[]

  @AllowNull(true)
  @Default(null)
  @Column
  startAt: number

  @AllowNull(true)
  @Default(null)
  @Column
  endAt: number

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

    serverAccountId: number
    user?: MUserAccountId

    id?: number
    predefinedReason?: VideoAbusePredefinedReasonsString
    state?: VideoAbuseState
    videoIs?: VideoAbuseVideoIs

    search?: string
    searchReporter?: string
    searchReportee?: string
    searchVideo?: string
    searchVideoChannel?: string
  }) {
    const {
      start,
      count,
      sort,
      search,
      user,
      serverAccountId,
      state,
      videoIs,
      predefinedReason,
      searchReportee,
      searchVideo,
      searchVideoChannel,
      searchReporter,
      id
    } = parameters

    const userAccountId = user ? user.Account.id : undefined
    const predefinedReasonId = predefinedReason ? videoAbusePredefinedReasonsMap[predefinedReason] : undefined

    const query = {
      offset: start,
      limit: count,
      order: getSort(sort),
      col: 'VideoAbuseModel.id',
      distinct: true
    }

    const filters = {
      id,
      predefinedReasonId,
      search,
      state,
      videoIs,
      searchReportee,
      searchVideo,
      searchVideoChannel,
      searchReporter,
      serverAccountId,
      userAccountId
    }

    return VideoAbuseModel
      .scope([
        { method: [ ScopeNames.FOR_API, filters ] }
      ])
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  toFormattedJSON (this: MVideoAbuseFormattable): VideoAbuse {
    const predefinedReasons = VideoAbuseModel.getPredefinedReasonsStrings(this.predefinedReasons)
    const countReportsForVideo = this.get('countReportsForVideo') as number
    const nthReportForVideo = this.get('nthReportForVideo') as number
    const countReportsForReporterVideo = this.get('countReportsForReporter__video') as number
    const countReportsForReporterDeletedVideo = this.get('countReportsForReporter__deletedVideo') as number
    const countReportsForReporteeVideo = this.get('countReportsForReportee__video') as number
    const countReportsForReporteeDeletedVideo = this.get('countReportsForReportee__deletedVideo') as number

    const video = this.Video
      ? this.Video
      : this.deletedVideo

    return {
      id: this.id,
      reason: this.reason,
      predefinedReasons,
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
        blacklisted: this.Video?.isBlacklisted() || false,
        thumbnailPath: this.Video?.getMiniatureStaticPath(),
        channel: this.Video?.VideoChannel.toFormattedJSON() || this.deletedVideo?.channel
      },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      startAt: this.startAt,
      endAt: this.endAt,
      count: countReportsForVideo || 0,
      nth: nthReportForVideo || 0,
      countReportsForReporter: (countReportsForReporterVideo || 0) + (countReportsForReporterDeletedVideo || 0),
      countReportsForReportee: (countReportsForReporteeVideo || 0) + (countReportsForReporteeDeletedVideo || 0)
    }
  }

  toActivityPubObject (this: MVideoAbuseVideo): VideoAbuseObject {
    const predefinedReasons = VideoAbuseModel.getPredefinedReasonsStrings(this.predefinedReasons)

    const startAt = this.startAt
    const endAt = this.endAt

    return {
      type: 'Flag' as 'Flag',
      content: this.reason,
      object: this.Video.url,
      tag: predefinedReasons.map(r => ({
        type: 'Hashtag' as 'Hashtag',
        name: r
      })),
      startAt,
      endAt
    }
  }

  private static getStateLabel (id: number) {
    return VIDEO_ABUSE_STATES[id] || 'Unknown'
  }

  private static getPredefinedReasonsStrings (predefinedReasons: VideoAbusePredefinedReasons[]): VideoAbusePredefinedReasonsString[] {
    return (predefinedReasons || [])
      .filter(r => r in VideoAbusePredefinedReasons)
      .map(r => invert(videoAbusePredefinedReasonsMap)[r] as VideoAbusePredefinedReasonsString)
  }
}
