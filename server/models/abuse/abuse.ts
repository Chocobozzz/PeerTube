import * as Bluebird from 'bluebird'
import { invert } from 'lodash'
import { literal, Op, WhereOptions } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasOne,
  Is,
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isAbuseModerationCommentValid, isAbuseReasonValid, isAbuseStateValid } from '@server/helpers/custom-validators/abuses'
import {
  Abuse,
  AbuseObject,
  AbusePredefinedReasons,
  abusePredefinedReasonsMap,
  AbusePredefinedReasonsString,
  AbuseState,
  AbuseVideoIs,
  VideoAbuse
} from '@shared/models'
import { AbuseFilter } from '@shared/models/moderation/abuse/abuse-filter'
import { CONSTRAINTS_FIELDS, ABUSE_STATES } from '../../initializers/constants'
import { MAbuse, MAbuseAP, MAbuseFormattable, MUserAccountId } from '../../types/models'
import { AccountModel, ScopeNames as AccountScopeNames } from '../account/account'
import { buildBlockedAccountSQL, getSort, searchAttribute, throwIfNotValid } from '../utils'
import { ThumbnailModel } from '../video/thumbnail'
import { VideoModel } from '../video/video'
import { VideoBlacklistModel } from '../video/video-blacklist'
import { ScopeNames as VideoChannelScopeNames, SummaryOptions, VideoChannelModel } from '../video/video-channel'
import { VideoAbuseModel } from './video-abuse'
import { VideoCommentAbuseModel } from './video-comment-abuse'

export enum ScopeNames {
  FOR_API = 'FOR_API'
}

@Scopes(() => ({
  [ScopeNames.FOR_API]: (options: {
    // search
    search?: string
    searchReporter?: string
    searchReportee?: string

    // video releated
    searchVideo?: string
    searchVideoChannel?: string
    videoIs?: AbuseVideoIs

    // filters
    id?: number
    predefinedReasonId?: number
    filter?: AbuseFilter

    state?: AbuseState

    // accountIds
    serverAccountId: number
    userAccountId: number
  }) => {
    const onlyBlacklisted = options.videoIs === 'blacklisted'
    const videoRequired = !!(onlyBlacklisted || options.searchVideo || options.searchVideoChannel)

    const where = {
      reporterAccountId: {
        [Op.notIn]: literal('(' + buildBlockedAccountSQL([ options.serverAccountId, options.userAccountId ]) + ')')
      }
    }

    if (options.search) {
      const escapedSearch = AbuseModel.sequelize.escape('%' + options.search + '%')

      Object.assign(where, {
        [Op.or]: [
          {
            [Op.and]: [
              { '$VideoAbuse.videoId$': { [Op.not]: null } },
              searchAttribute(options.search, '$VideoAbuse.Video.name$')
            ]
          },
          {
            [Op.and]: [
              { '$VideoAbuse.videoId$': { [Op.not]: null } },
              searchAttribute(options.search, '$VideoAbuse.Video.VideoChannel.name$')
            ]
          },
          {
            [Op.and]: [
              { '$VideoAbuse.deletedVideo$': { [Op.not]: null } },
              literal(`"VideoAbuse"."deletedVideo"->>'name' ILIKE ${escapedSearch}`)
            ]
          },
          {
            [Op.and]: [
              { '$VideoAbuse.deletedVideo$': { [Op.not]: null } },
              literal(`"VideoAbuse"."deletedVideo"->'channel'->>'displayName' ILIKE ${escapedSearch}`)
            ]
          },
          searchAttribute(options.search, '$ReporterAccount.name$'),
          searchAttribute(options.search, '$FlaggedAccount.name$')
        ]
      })
    }

    if (options.id) Object.assign(where, { id: options.id })
    if (options.state) Object.assign(where, { state: options.state })

    if (options.videoIs === 'deleted') {
      Object.assign(where, {
        '$VideoAbuse.deletedVideo$': {
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

    return {
      attributes: {
        include: [
          [
            // we don't care about this count for deleted videos, so there are not included
            literal(
              '(' +
                'SELECT count(*) ' +
                'FROM "videoAbuse" ' +
                'WHERE "videoId" = "VideoAbuse"."videoId" ' +
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
                'WHERE t.id = "VideoAbuse".id' +
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
                'WHERE "account"."id" = "AbuseModel"."reporterAccountId" ' +
              ')'
            ),
            'countReportsForReporter__video'
          ],
          [
            literal(
              '(' +
                'SELECT count(DISTINCT "videoAbuse"."id") ' +
                'FROM "videoAbuse" ' +
                `WHERE CAST("deletedVideo"->'channel'->'ownerAccount'->>'id' AS INTEGER) = "AbuseModel"."reporterAccountId" ` +
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
                      '"videoChannel"."accountId" = "VideoAbuse->Video->VideoChannel"."accountId" ' +
                   `OR "videoChannel"."accountId" = CAST("VideoAbuse"."deletedVideo"->'channel'->'ownerAccount'->>'id' AS INTEGER) ` +
              ')'
            ),
            'countReportsForReportee__video'
          ],
          [
            literal(
              '(' +
                'SELECT count(DISTINCT "videoAbuse"."id") ' +
                'FROM "videoAbuse" ' +
                `WHERE CAST("deletedVideo"->'channel'->'ownerAccount'->>'id' AS INTEGER) = "VideoAbuse->Video->VideoChannel"."accountId" ` +
                   `OR CAST("deletedVideo"->'channel'->'ownerAccount'->>'id' AS INTEGER) = ` +
                      `CAST("VideoAbuse"."deletedVideo"->'channel'->'ownerAccount'->>'id' AS INTEGER) ` +
              ')'
            ),
            'countReportsForReportee__deletedVideo'
          ]
        ]
      },
      include: [
        {
          model: AccountModel.scope(AccountScopeNames.SUMMARY),
          as: 'ReporterAccount',
          required: true,
          where: searchAttribute(options.searchReporter, 'name')
        },
        {
          model: AccountModel.scope(AccountScopeNames.SUMMARY),
          as: 'FlaggedAccount',
          required: true,
          where: searchAttribute(options.searchReportee, 'name')
        },
        {
          model: VideoAbuseModel,
          required: options.filter === 'video' || !!options.videoIs || videoRequired,
          include: [
            {
              model: VideoModel,
              required: videoRequired,
              where: searchAttribute(options.searchVideo, 'name'),
              include: [
                {
                  model: ThumbnailModel
                },
                {
                  model: VideoChannelModel.scope({ method: [ VideoChannelScopeNames.SUMMARY, { withAccount: false } as SummaryOptions ] }),
                  where: searchAttribute(options.searchVideoChannel, 'name'),
                  required: true,
                  include: [
                    {
                      model: AccountModel.scope(AccountScopeNames.SUMMARY),
                      required: true,
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
          ]
        }
      ],
      where
    }
  }
}))
@Table({
  tableName: 'abuse',
  indexes: [
    {
      fields: [ 'reporterAccountId' ]
    },
    {
      fields: [ 'flaggedAccountId' ]
    }
  ]
})
export class AbuseModel extends Model<AbuseModel> {

  @AllowNull(false)
  @Default(null)
  @Is('VideoAbuseReason', value => throwIfNotValid(value, isAbuseReasonValid, 'reason'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ABUSES.REASON.max))
  reason: string

  @AllowNull(false)
  @Default(null)
  @Is('VideoAbuseState', value => throwIfNotValid(value, isAbuseStateValid, 'state'))
  @Column
  state: AbuseState

  @AllowNull(true)
  @Default(null)
  @Is('VideoAbuseModerationComment', value => throwIfNotValid(value, isAbuseModerationCommentValid, 'moderationComment', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ABUSES.MODERATION_COMMENT.max))
  moderationComment: string

  @AllowNull(true)
  @Default(null)
  @Column(DataType.ARRAY(DataType.INTEGER))
  predefinedReasons: AbusePredefinedReasons[]

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => AccountModel)
  @Column
  reporterAccountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      name: 'reporterAccountId',
      allowNull: true
    },
    as: 'ReporterAccount',
    onDelete: 'set null'
  })
  ReporterAccount: AccountModel

  @ForeignKey(() => AccountModel)
  @Column
  flaggedAccountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      name: 'flaggedAccountId',
      allowNull: true
    },
    as: 'FlaggedAccount',
    onDelete: 'set null'
  })
  FlaggedAccount: AccountModel

  @HasOne(() => VideoCommentAbuseModel, {
    foreignKey: {
      name: 'abuseId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  VideoCommentAbuse: VideoCommentAbuseModel

  @HasOne(() => VideoAbuseModel, {
    foreignKey: {
      name: 'abuseId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  VideoAbuse: VideoAbuseModel

  static loadByIdAndVideoId (id: number, videoId?: number, uuid?: string): Bluebird<MAbuse> {
    const videoWhere: WhereOptions = {}

    if (videoId) videoWhere.videoId = videoId
    if (uuid) videoWhere.deletedVideo = { uuid }

    const query = {
      include: [
        {
          model: VideoAbuseModel,
          required: true,
          where: videoWhere
        }
      ],
      where: {
        id
      }
    }
    return AbuseModel.findOne(query)
  }

  static listForApi (parameters: {
    start: number
    count: number
    sort: string

    filter?: AbuseFilter

    serverAccountId: number
    user?: MUserAccountId

    id?: number
    predefinedReason?: AbusePredefinedReasonsString
    state?: AbuseState
    videoIs?: AbuseVideoIs

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
      filter,
      searchVideoChannel,
      searchReporter,
      id
    } = parameters

    const userAccountId = user ? user.Account.id : undefined
    const predefinedReasonId = predefinedReason ? abusePredefinedReasonsMap[predefinedReason] : undefined

    const query = {
      offset: start,
      limit: count,
      order: getSort(sort),
      col: 'AbuseModel.id',
      distinct: true
    }

    const filters = {
      id,
      filter,
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

    return AbuseModel
      .scope([
        { method: [ ScopeNames.FOR_API, filters ] }
      ])
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  toFormattedJSON (this: MAbuseFormattable): Abuse {
    const predefinedReasons = AbuseModel.getPredefinedReasonsStrings(this.predefinedReasons)
    const countReportsForVideo = this.get('countReportsForVideo') as number
    const nthReportForVideo = this.get('nthReportForVideo') as number
    const countReportsForReporterVideo = this.get('countReportsForReporter__video') as number
    const countReportsForReporterDeletedVideo = this.get('countReportsForReporter__deletedVideo') as number
    const countReportsForReporteeVideo = this.get('countReportsForReportee__video') as number
    const countReportsForReporteeDeletedVideo = this.get('countReportsForReportee__deletedVideo') as number

    let video: VideoAbuse

    if (this.VideoAbuse) {
      const abuseModel = this.VideoAbuse
      const entity = abuseModel.Video || abuseModel.deletedVideo

      video = {
        id: entity.id,
        uuid: entity.uuid,
        name: entity.name,
        nsfw: entity.nsfw,

        startAt: abuseModel.startAt,
        endAt: abuseModel.endAt,

        deleted: !abuseModel.Video,
        blacklisted: abuseModel.Video?.isBlacklisted() || false,
        thumbnailPath: abuseModel.Video?.getMiniatureStaticPath(),
        channel: abuseModel.Video?.VideoChannel.toFormattedJSON() || abuseModel.deletedVideo?.channel
      }
    }

    return {
      id: this.id,
      reason: this.reason,
      predefinedReasons,

      reporterAccount: this.ReporterAccount.toFormattedJSON(),

      state: {
        id: this.state,
        label: AbuseModel.getStateLabel(this.state)
      },

      moderationComment: this.moderationComment,

      video,
      comment: null,

      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      count: countReportsForVideo || 0,
      nth: nthReportForVideo || 0,
      countReportsForReporter: (countReportsForReporterVideo || 0) + (countReportsForReporterDeletedVideo || 0),
      countReportsForReportee: (countReportsForReporteeVideo || 0) + (countReportsForReporteeDeletedVideo || 0),

      // FIXME: deprecated in 2.3, remove this
      startAt: null,
      endAt: null
    }
  }

  toActivityPubObject (this: MAbuseAP): AbuseObject {
    const predefinedReasons = AbuseModel.getPredefinedReasonsStrings(this.predefinedReasons)

    const object = this.VideoAbuse?.Video?.url || this.VideoCommentAbuse?.VideoComment?.url || this.FlaggedAccount.Actor.url

    const startAt = this.VideoAbuse?.startAt
    const endAt = this.VideoAbuse?.endAt

    return {
      type: 'Flag' as 'Flag',
      content: this.reason,
      object,
      tag: predefinedReasons.map(r => ({
        type: 'Hashtag' as 'Hashtag',
        name: r
      })),
      startAt,
      endAt
    }
  }

  private static getStateLabel (id: number) {
    return ABUSE_STATES[id] || 'Unknown'
  }

  private static getPredefinedReasonsStrings (predefinedReasons: AbusePredefinedReasons[]): AbusePredefinedReasonsString[] {
    return (predefinedReasons || [])
      .filter(r => r in AbusePredefinedReasons)
      .map(r => invert(abusePredefinedReasonsMap)[r] as AbusePredefinedReasonsString)
  }
}
