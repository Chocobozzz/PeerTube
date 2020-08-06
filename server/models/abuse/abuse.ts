import * as Bluebird from 'bluebird'
import { invert } from 'lodash'
import { literal, Op, QueryTypes, WhereOptions } from 'sequelize'
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
import { abusePredefinedReasonsMap } from '@shared/core-utils/abuse'
import {
  AbuseFilter,
  AbuseObject,
  AbusePredefinedReasons,
  AbusePredefinedReasonsString,
  AbuseState,
  AbuseVideoIs,
  AdminAbuse,
  AdminVideoAbuse,
  AdminVideoCommentAbuse,
  UserAbuse,
  UserVideoAbuse
} from '@shared/models'
import { ABUSE_STATES, CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { MAbuseAdminFormattable, MAbuseAP, MAbuseFull, MAbuseReporter, MAbuseUserFormattable, MUserAccountId } from '../../types/models'
import { AccountModel, ScopeNames as AccountScopeNames, SummaryOptions as AccountSummaryOptions } from '../account/account'
import { getSort, throwIfNotValid } from '../utils'
import { ThumbnailModel } from '../video/thumbnail'
import { ScopeNames as VideoScopeNames, VideoModel } from '../video/video'
import { VideoBlacklistModel } from '../video/video-blacklist'
import { ScopeNames as VideoChannelScopeNames, SummaryOptions as ChannelSummaryOptions, VideoChannelModel } from '../video/video-channel'
import { ScopeNames as CommentScopeNames, VideoCommentModel } from '../video/video-comment'
import { buildAbuseListQuery, BuildAbusesQueryOptions } from './abuse-query-builder'
import { VideoAbuseModel } from './video-abuse'
import { VideoCommentAbuseModel } from './video-comment-abuse'

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
                'WHERE "videoId" = "VideoAbuse"."videoId" AND "videoId" IS NOT NULL' +
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
                'WHERE t.id = "VideoAbuse".id AND t.id IS NOT NULL' +
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
export class AbuseModel extends Model<AbuseModel> {

  @AllowNull(false)
  @Default(null)
  @Is('AbuseReason', value => throwIfNotValid(value, isAbuseReasonValid, 'reason'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ABUSES.REASON.max))
  reason: string

  @AllowNull(false)
  @Default(null)
  @Is('AbuseState', value => throwIfNotValid(value, isAbuseStateValid, 'state'))
  @Column
  state: AbuseState

  @AllowNull(true)
  @Default(null)
  @Is('AbuseModerationComment', value => throwIfNotValid(value, isAbuseModerationCommentValid, 'moderationComment', true))
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

  // FIXME: deprecated in 2.3. Remove these validators
  static loadByIdAndVideoId (id: number, videoId?: number, uuid?: string): Bluebird<MAbuseReporter> {
    const videoWhere: WhereOptions = {}

    if (videoId) videoWhere.videoId = videoId
    if (uuid) videoWhere.deletedVideo = { uuid }

    const query = {
      include: [
        {
          model: VideoAbuseModel,
          required: true,
          where: videoWhere
        },
        {
          model: AccountModel,
          as: 'ReporterAccount'
        }
      ],
      where: {
        id
      }
    }
    return AbuseModel.findOne(query)
  }

  static loadByIdWithReporter (id: number): Bluebird<MAbuseReporter> {
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

  static loadFull (id: number): Bluebird<MAbuseFull> {
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
    state?: AbuseState
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

  buildBaseVideoCommentAbuse (this: MAbuseUserFormattable) {
    if (!this.VideoCommentAbuse) return null

    const abuseModel = this.VideoCommentAbuse
    const entity = abuseModel.VideoComment

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
      countReportsForReportee: (countReportsForReportee || 0),

      // FIXME: deprecated in 2.3, remove this
      startAt: null,
      endAt: null,
      count: countReportsForVideo || 0,
      nth: nthReportForVideo || 0
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
                       }
                     })
  }

  private static getStateLabel (id: number) {
    return ABUSE_STATES[id] || 'Unknown'
  }

  private static getPredefinedReasonsStrings (predefinedReasons: AbusePredefinedReasons[]): AbusePredefinedReasonsString[] {
    const invertedPredefinedReasons = invert(abusePredefinedReasonsMap)

    return (predefinedReasons || [])
      .map(r => invertedPredefinedReasons[r] as AbusePredefinedReasonsString)
      .filter(v => !!v)
  }
}
