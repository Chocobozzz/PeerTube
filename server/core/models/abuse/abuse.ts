import { abusePredefinedReasonsMap, forceNumber } from '@peertube/peertube-core-utils'
import {
  AbuseFilter,
  AbuseObject,
  AbusePredefinedReasonsString,
  AbusePredefinedReasonsType,
  AbuseVideoIs,
  AdminAbuse,
  AdminVideoAbuse,
  AdminVideoCommentAbuse,
  UserAbuse,
  UserVideoAbuse,
  type AbuseStateType,
  AbuseState
} from '@peertube/peertube-models'
import { isAbuseModerationCommentValid, isAbuseReasonValid, isAbuseStateValid } from '@server/helpers/custom-validators/abuses.js'
import invert from 'lodash-es/invert.js'
import { Op, QueryTypes, literal } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasOne,
  Is, Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { ABUSE_STATES, CONSTRAINTS_FIELDS } from '../../initializers/constants.js'
import {
  MAbuseAP,
  MAbuseAdminFormattable,
  MAbuseFull,
  MAbuseReporter,
  MAbuseUserFormattable,
  MUserAccountId
} from '../../types/models/index.js'
import { AccountModel, ScopeNames as AccountScopeNames, SummaryOptions as AccountSummaryOptions } from '../account/account.js'
import { SequelizeModel, getSort, parseAggregateResult, throwIfNotValid } from '../shared/index.js'
import { ThumbnailModel } from '../video/thumbnail.js'
import { VideoBlacklistModel } from '../video/video-blacklist.js'
import { SummaryOptions as ChannelSummaryOptions, VideoChannelModel, ScopeNames as VideoChannelScopeNames } from '../video/video-channel.js'
import { ScopeNames as CommentScopeNames, VideoCommentModel } from '../video/video-comment.js'
import { VideoModel, ScopeNames as VideoScopeNames } from '../video/video.js'
import { BuildAbusesQueryOptions, buildAbuseListQuery } from './sql/abuse-query-builder.js'
import { VideoAbuseModel } from './video-abuse.js'
import { VideoCommentAbuseModel } from './video-comment-abuse.js'

export enum ScopeNames {
  FOR_API = 'FOR_API'
}

@Scopes(() => ({
  [ScopeNames.FOR_API]: () => {
    return {
      attributes: {
        include: [
          [
            literal(
              '(' +
                'SELECT count(*) ' +
                'FROM "abuseMessage" ' +
                'WHERE "abuseId" = "AbuseModel"."id"' +
              ')'
            ),
            'countMessages'
          ],
          [
            // we don't care about this count for deleted videos, so there are not included
            literal(
              '(' +
                'SELECT count(*) ' +
                'FROM "videoAbuse" ' +
                'WHERE "videoId" IN (SELECT "videoId" FROM "videoAbuse" WHERE "abuseId" = "AbuseModel"."id") ' +
                'AND "videoId" IS NOT NULL' +
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
                  'SELECT id, "abuseId", row_number() OVER (PARTITION BY "videoId" ORDER BY "createdAt") AS nth ' +
                  'FROM "videoAbuse" ' +
                ') t ' +
                'WHERE t."abuseId" = "AbuseModel"."id" ' +
              ')'
            ),
            'nthReportForVideo'
          ],
          [
            literal(
              '(' +
                'SELECT count("abuse"."id") ' +
                'FROM "abuse" ' +
                'WHERE "abuse"."reporterAccountId" = "AbuseModel"."reporterAccountId"' +
              ')'
            ),
            'countReportsForReporter'
          ],
          [
            literal(
              '(' +
                'SELECT count("abuse"."id") ' +
                'FROM "abuse" ' +
                'WHERE "abuse"."flaggedAccountId" = "AbuseModel"."flaggedAccountId"' +
              ')'
            ),
            'countReportsForReportee'
          ]
        ]
      },
      include: [
        {
          model: AccountModel.scope({
            method: [
              AccountScopeNames.SUMMARY,
              { actorRequired: false } as AccountSummaryOptions
            ]
          }),
          as: 'ReporterAccount'
        },
        {
          model: AccountModel.scope({
            method: [
              AccountScopeNames.SUMMARY,
              { actorRequired: false } as AccountSummaryOptions
            ]
          }),
          as: 'FlaggedAccount'
        },
        {
          model: VideoCommentAbuseModel.unscoped(),
          include: [
            {
              model: VideoCommentModel.unscoped(),
              include: [
                {
                  model: VideoModel.unscoped(),
                  attributes: [ 'name', 'id', 'uuid' ]
                }
              ]
            }
          ]
        },
        {
          model: VideoAbuseModel.unscoped(),
          include: [
            {
              attributes: [ 'id', 'uuid', 'name', 'nsfw' ],
              model: VideoModel.unscoped(),
              include: [
                {
                  attributes: [ 'filename', 'fileUrl', 'type' ],
                  model: ThumbnailModel
                },
                {
                  model: VideoChannelModel.scope({
                    method: [
                      VideoChannelScopeNames.SUMMARY,
                      { withAccount: false, actorRequired: false } as ChannelSummaryOptions
                    ]
                  }),
                  required: false
                },
                {
                  attributes: [ 'id', 'reason', 'unfederated' ],
                  required: false,
                  model: VideoBlacklistModel
                }
              ]
            }
          ]
        }
      ]
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
export class AbuseModel extends SequelizeModel<AbuseModel> {

  @AllowNull(false)
  @Default(null)
  @Is('AbuseReason', value => throwIfNotValid(value, isAbuseReasonValid, 'reason'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ABUSES.REASON.max))
  reason: string

  @AllowNull(false)
  @Default(null)
  @Is('AbuseState', value => throwIfNotValid(value, isAbuseStateValid, 'state'))
  @Column
  state: AbuseStateType

  @AllowNull(true)
  @Default(null)
  @Is('AbuseModerationComment', value => throwIfNotValid(value, isAbuseModerationCommentValid, 'moderationComment', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ABUSES.MODERATION_COMMENT.max))
  moderationComment: string

  @AllowNull(true)
  @Default(null)
  @Column(DataType.ARRAY(DataType.INTEGER))
  predefinedReasons: AbusePredefinedReasonsType[]

  @AllowNull(true)
  @Column
  processedAt: Date

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
  ReporterAccount: Awaited<AccountModel>

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
  FlaggedAccount: Awaited<AccountModel>

  @HasOne(() => VideoCommentAbuseModel, {
    foreignKey: {
      name: 'abuseId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  VideoCommentAbuse: Awaited<VideoCommentAbuseModel>

  @HasOne(() => VideoAbuseModel, {
    foreignKey: {
      name: 'abuseId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  VideoAbuse: Awaited<VideoAbuseModel>

  static loadByIdWithReporter (id: number): Promise<MAbuseReporter> {
    const query = {
      where: {
        id
      },
      include: [
        {
          model: AccountModel,
          as: 'ReporterAccount'
        }
      ]
    }

    return AbuseModel.findOne(query)
  }

  static loadFull (id: number): Promise<MAbuseFull> {
    const query = {
      where: {
        id
      },
      include: [
        {
          model: AccountModel.scope(AccountScopeNames.SUMMARY),
          required: false,
          as: 'ReporterAccount'
        },
        {
          model: AccountModel.scope(AccountScopeNames.SUMMARY),
          as: 'FlaggedAccount'
        },
        {
          model: VideoAbuseModel,
          required: false,
          include: [
            {
              model: VideoModel.scope([ VideoScopeNames.WITH_ACCOUNT_DETAILS ])
            }
          ]
        },
        {
          model: VideoCommentAbuseModel,
          required: false,
          include: [
            {
              model: VideoCommentModel.scope([
                CommentScopeNames.WITH_ACCOUNT
              ]),
              include: [
                {
                  model: VideoModel
                }
              ]
            }
          ]
        }
      ]
    }

    return AbuseModel.findOne(query)
  }

  static async listForAdminApi (parameters: {
    start: number
    count: number
    sort: string

    filter?: AbuseFilter

    serverAccountId: number
    user?: MUserAccountId

    id?: number
    predefinedReason?: AbusePredefinedReasonsString
    state?: AbuseStateType
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

    const queryOptions: BuildAbusesQueryOptions = {
      start,
      count,
      sort,
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

    const [ total, data ] = await Promise.all([
      AbuseModel.internalCountForApi(queryOptions),
      AbuseModel.internalListForApi(queryOptions)
    ])

    return { total, data }
  }

  static async listForUserApi (parameters: {
    user: MUserAccountId

    start: number
    count: number
    sort: string

    id?: number
    search?: string
    state?: AbuseStateType
  }) {
    const {
      start,
      count,
      sort,
      search,
      user,
      state,
      id
    } = parameters

    const queryOptions: BuildAbusesQueryOptions = {
      start,
      count,
      sort,
      id,
      search,
      state,
      reporterAccountId: user.Account.id
    }

    const [ total, data ] = await Promise.all([
      AbuseModel.internalCountForApi(queryOptions),
      AbuseModel.internalListForApi(queryOptions)
    ])

    return { total, data }
  }

  // ---------------------------------------------------------------------------

  static getStats () {
    const query = `SELECT ` +
      `AVG(EXTRACT(EPOCH FROM ("processedAt" - "createdAt") * 1000)) ` +
        `FILTER (WHERE "processedAt" IS NOT NULL AND "createdAt" > CURRENT_DATE - INTERVAL '3 months')` +
        `AS "avgResponseTime", ` +
      // "processedAt" has been introduced in PeerTube 6.1 so also check the abuse state to check processed abuses
      `COUNT(*) FILTER (WHERE "processedAt" IS NOT NULL OR "state" != ${AbuseState.PENDING}) AS "processedAbuses", ` +
      `COUNT(*) AS "totalAbuses" ` +
      `FROM "abuse"`

    return AbuseModel.sequelize.query<any>(query, {
      type: QueryTypes.SELECT,
      raw: true
    }).then(([ row ]) => {
      return {
        totalAbuses: parseAggregateResult(row.totalAbuses),

        totalAbusesProcessed: parseAggregateResult(row.processedAbuses),

        averageAbuseResponseTimeMs: row?.avgResponseTime
          ? forceNumber(row.avgResponseTime)
          : null
      }
    })
  }

  // ---------------------------------------------------------------------------

  buildBaseVideoCommentAbuse (this: MAbuseUserFormattable) {
    // Associated video comment could have been destroyed if the video has been deleted
    if (!this.VideoCommentAbuse?.VideoComment) return null

    const entity = this.VideoCommentAbuse.VideoComment

    return {
      id: entity.id,
      threadId: entity.getThreadId(),

      text: entity.text ?? '',

      deleted: entity.isDeleted(),

      video: {
        id: entity.Video.id,
        name: entity.Video.name,
        uuid: entity.Video.uuid
      }
    }
  }

  buildBaseVideoAbuse (this: MAbuseUserFormattable): UserVideoAbuse {
    if (!this.VideoAbuse) return null

    const abuseModel = this.VideoAbuse
    const entity = abuseModel.Video || abuseModel.deletedVideo

    return {
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

  buildBaseAbuse (this: MAbuseUserFormattable, countMessages: number): UserAbuse {
    const predefinedReasons = AbuseModel.getPredefinedReasonsStrings(this.predefinedReasons)

    return {
      id: this.id,
      reason: this.reason,
      predefinedReasons,

      flaggedAccount: this.FlaggedAccount
        ? this.FlaggedAccount.toFormattedJSON()
        : null,

      state: {
        id: this.state,
        label: AbuseModel.getStateLabel(this.state)
      },

      countMessages,

      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  toFormattedAdminJSON (this: MAbuseAdminFormattable): AdminAbuse {
    const countReportsForVideo = this.get('countReportsForVideo') as number
    const nthReportForVideo = this.get('nthReportForVideo') as number

    const countReportsForReporter = this.get('countReportsForReporter') as number
    const countReportsForReportee = this.get('countReportsForReportee') as number

    const countMessages = this.get('countMessages') as number

    const baseVideo = this.buildBaseVideoAbuse()
    const video: AdminVideoAbuse = baseVideo
      ? Object.assign(baseVideo, {
        countReports: countReportsForVideo,
        nthReport: nthReportForVideo
      })
      : null

    const comment: AdminVideoCommentAbuse = this.buildBaseVideoCommentAbuse()

    const abuse = this.buildBaseAbuse(countMessages || 0)

    return Object.assign(abuse, {
      video,
      comment,

      moderationComment: this.moderationComment,

      reporterAccount: this.ReporterAccount
        ? this.ReporterAccount.toFormattedJSON()
        : null,

      countReportsForReporter: (countReportsForReporter || 0),
      countReportsForReportee: (countReportsForReportee || 0)
    })
  }

  toFormattedUserJSON (this: MAbuseUserFormattable): UserAbuse {
    const countMessages = this.get('countMessages') as number

    const video = this.buildBaseVideoAbuse()
    const comment = this.buildBaseVideoCommentAbuse()
    const abuse = this.buildBaseAbuse(countMessages || 0)

    return Object.assign(abuse, {
      video,
      comment
    })
  }

  toActivityPubObject (this: MAbuseAP): AbuseObject {
    const predefinedReasons = AbuseModel.getPredefinedReasonsStrings(this.predefinedReasons)

    const object = this.VideoAbuse?.Video?.url || this.VideoCommentAbuse?.VideoComment?.url || this.FlaggedAccount.Actor.url

    const startAt = this.VideoAbuse?.startAt
    const endAt = this.VideoAbuse?.endAt

    return {
      type: 'Flag' as 'Flag',
      content: this.reason,
      mediaType: 'text/markdown',
      object,
      tag: predefinedReasons.map(r => ({
        type: 'Hashtag' as 'Hashtag',
        name: r
      })),
      startAt,
      endAt
    }
  }

  private static async internalCountForApi (parameters: BuildAbusesQueryOptions) {
    const { query, replacements } = buildAbuseListQuery(parameters, 'count')
    const options = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      replacements
    }

    const [ { total } ] = await AbuseModel.sequelize.query<{ total: string }>(query, options)
    if (total === null) return 0

    return parseInt(total, 10)
  }

  private static async internalListForApi (parameters: BuildAbusesQueryOptions) {
    const { query, replacements } = buildAbuseListQuery(parameters, 'id')
    const options = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      replacements
    }

    const rows = await AbuseModel.sequelize.query<{ id: string }>(query, options)
    const ids = rows.map(r => r.id)

    if (ids.length === 0) return []

    return AbuseModel.scope(ScopeNames.FOR_API)
                     .findAll({
                       order: getSort(parameters.sort),
                       where: {
                         id: {
                           [Op.in]: ids
                         }
                       },
                       limit: parameters.count
                     })
  }

  private static getStateLabel (id: number) {
    return ABUSE_STATES[id] || 'Unknown'
  }

  private static getPredefinedReasonsStrings (predefinedReasons: AbusePredefinedReasonsType[]): AbusePredefinedReasonsString[] {
    const invertedPredefinedReasons = invert(abusePredefinedReasonsMap)

    return (predefinedReasons || [])
      .map(r => invertedPredefinedReasons[r] as AbusePredefinedReasonsString)
      .filter(v => !!v)
  }
}
