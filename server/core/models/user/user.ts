import { forceNumber, hasUserRight, USER_ROLE_LABELS } from '@peertube/peertube-core-utils'
import {
  AbuseState,
  MyUser,
  User,
  UserAdminFlag,
  UserRightType,
  VideoPlaylistType,
  type NSFWPolicyType,
  type UserAdminFlagType,
  type UserRoleType,
  UserRole
} from '@peertube/peertube-models'
import { TokensCache } from '@server/lib/auth/tokens-cache.js'
import { LiveQuotaStore } from '@server/lib/live/index.js'
import {
  MMyUserFormattable,
  MUser,
  MUserDefault,
  MUserFormattable,
  MUserNotifSettingChannelDefault,
  MUserWithNotificationSetting
} from '@server/types/models/index.js'
import { col, FindOptions, fn, literal, Op, QueryTypes, ScopeOptions, where, WhereOptions } from 'sequelize'
import {
  AfterDestroy,
  AfterUpdate,
  AllowNull,
  BeforeCreate,
  BeforeUpdate,
  Column,
  CreatedAt,
  DataType,
  Default,
  DefaultScope,
  HasMany,
  HasOne,
  Is,
  IsEmail,
  IsUUID, Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isThemeNameValid } from '../../helpers/custom-validators/plugins.js'
import {
  isUserAdminFlagsValid,
  isUserAutoPlayNextVideoPlaylistValid,
  isUserAutoPlayNextVideoValid,
  isUserAutoPlayVideoValid,
  isUserBlockedReasonValid,
  isUserBlockedValid,
  isUserEmailVerifiedValid,
  isUserNoModal,
  isUserNSFWPolicyValid,
  isUserP2PEnabledValid,
  isUserPasswordValid,
  isUserRoleValid,
  isUserVideoLanguages,
  isUserVideoQuotaDailyValid,
  isUserVideoQuotaValid,
  isUserVideosHistoryEnabledValid
} from '../../helpers/custom-validators/users.js'
import { comparePassword, cryptPassword } from '../../helpers/peertube-crypto.js'
import { DEFAULT_USER_THEME_NAME, NSFW_POLICY_TYPES } from '../../initializers/constants.js'
import { getThemeOrDefault } from '../../lib/plugins/theme-utils.js'
import { AccountModel } from '../account/account.js'
import { ActorFollowModel } from '../actor/actor-follow.js'
import { ActorImageModel } from '../actor/actor-image.js'
import { ActorModel } from '../actor/actor.js'
import { OAuthTokenModel } from '../oauth/oauth-token.js'
import { getAdminUsersSort, parseAggregateResult, SequelizeModel, throwIfNotValid } from '../shared/index.js'
import { VideoChannelModel } from '../video/video-channel.js'
import { VideoImportModel } from '../video/video-import.js'
import { VideoLiveModel } from '../video/video-live.js'
import { VideoPlaylistModel } from '../video/video-playlist.js'
import { VideoModel } from '../video/video.js'
import { UserNotificationSettingModel } from './user-notification-setting.js'
import { UserExportModel } from './user-export.js'

enum ScopeNames {
  FOR_ME_API = 'FOR_ME_API',
  WITH_VIDEOCHANNELS = 'WITH_VIDEOCHANNELS',
  WITH_QUOTA = 'WITH_QUOTA',
  WITH_TOTAL_FILE_SIZES = 'WITH_TOTAL_FILE_SIZES',
  WITH_STATS = 'WITH_STATS'
}

type WhereUserIdScopeOptions = { whereUserId?: '$userId' | '"UserModel"."id"' }

@DefaultScope(() => ({
  include: [
    {
      model: AccountModel,
      required: true
    },
    {
      model: UserNotificationSettingModel,
      required: true
    }
  ]
}))
@Scopes(() => ({
  [ScopeNames.FOR_ME_API]: {
    include: [
      {
        model: AccountModel,
        include: [
          {
            model: VideoChannelModel.unscoped(),
            include: [
              {
                model: ActorModel,
                required: true,
                include: [
                  {
                    model: ActorImageModel,
                    as: 'Banners',
                    required: false
                  }
                ]
              }
            ]
          },
          {
            attributes: [ 'id', 'name', 'type' ],
            model: VideoPlaylistModel.unscoped(),
            required: true,
            where: {
              type: {
                [Op.ne]: VideoPlaylistType.REGULAR
              }
            }
          }
        ]
      },
      {
        model: UserNotificationSettingModel,
        required: true
      }
    ]
  },
  [ScopeNames.WITH_VIDEOCHANNELS]: {
    include: [
      {
        model: AccountModel,
        include: [
          {
            model: VideoChannelModel
          },
          {
            attributes: [ 'id', 'name', 'type' ],
            model: VideoPlaylistModel.unscoped(),
            required: true,
            where: {
              type: {
                [Op.ne]: VideoPlaylistType.REGULAR
              }
            }
          }
        ]
      }
    ]
  },
  [ScopeNames.WITH_QUOTA]: (options: WhereUserIdScopeOptions = {}) => {
    return {
      attributes: {
        include: [
          [
            literal(
              '(' +
                UserModel.generateUserQuotaBaseSQL({
                  whereUserId: options.whereUserId ?? '"UserModel"."id"',
                  daily: false,
                  onlyMaxResolution: true
                }) +
              ')'
            ),
            'videoQuotaUsed'
          ],
          [
            literal(
              '(' +
                UserModel.generateUserQuotaBaseSQL({
                  whereUserId: options.whereUserId ?? '"UserModel"."id"',
                  daily: true,
                  onlyMaxResolution: true
                }) +
              ')'
            ),
            'videoQuotaUsedDaily'
          ]
        ]
      }
    }
  },
  [ScopeNames.WITH_TOTAL_FILE_SIZES]: (options: WhereUserIdScopeOptions = {}) => {
    return {
      attributes: {
        include: [
          [
            literal(
              '(' +
                UserModel.generateUserQuotaBaseSQL({
                  whereUserId: options.whereUserId ?? '"UserModel"."id"',
                  daily: false,
                  onlyMaxResolution: false
                }) +
              ')'
            ),
            'totalVideoFileSize'
          ]
        ]
      }
    }
  },
  [ScopeNames.WITH_STATS]: (options: WhereUserIdScopeOptions = {}) => {
    return {
      attributes: {
        include: [
          [
            literal(
              '(' +
                'SELECT COUNT("video"."id") ' +
                'FROM "video" ' +
                'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
                'INNER JOIN "account" ON "account"."id" = "videoChannel"."accountId" ' +
                `WHERE "account"."userId" = ${options.whereUserId}` +
              ')'
            ),
            'videosCount'
          ],
          [
            literal(
              '(' +
                `SELECT concat_ws(':', "abuses", "acceptedAbuses") ` +
                'FROM (' +
                  'SELECT COUNT("abuse"."id") AS "abuses", ' +
                        `COUNT("abuse"."id") FILTER (WHERE "abuse"."state" = ${AbuseState.ACCEPTED}) AS "acceptedAbuses" ` +
                  'FROM "abuse" ' +
                  'INNER JOIN "account" ON "account"."id" = "abuse"."flaggedAccountId" ' +
                  `WHERE "account"."userId" = ${options.whereUserId}` +
                ') t' +
              ')'
            ),
            'abusesCount'
          ],
          [
            literal(
              '(' +
                'SELECT COUNT("abuse"."id") ' +
                'FROM "abuse" ' +
                'INNER JOIN "account" ON "account"."id" = "abuse"."reporterAccountId" ' +
                `WHERE "account"."userId" = ${options.whereUserId}` +
              ')'
            ),
            'abusesCreatedCount'
          ],
          [
            literal(
              '(' +
                'SELECT COUNT("videoComment"."id") ' +
                'FROM "videoComment" ' +
                'INNER JOIN "account" ON "account"."id" = "videoComment"."accountId" ' +
                `WHERE "account"."userId" = ${options.whereUserId}` +
              ')'
            ),
            'videoCommentsCount'
          ]
        ]
      }
    }
  }
}))
@Table({
  tableName: 'user',
  indexes: [
    {
      fields: [ 'username' ],
      unique: true
    },
    {
      fields: [ 'email' ],
      unique: true
    }
  ]
})
export class UserModel extends SequelizeModel<UserModel> {

  @AllowNull(true)
  @Is('UserPassword', value => throwIfNotValid(value, isUserPasswordValid, 'user password', true))
  @Column
  password: string

  @AllowNull(false)
  @Column
  username: string

  @AllowNull(false)
  @IsEmail
  @Column(DataType.STRING(400))
  email: string

  @AllowNull(true)
  @IsEmail
  @Column(DataType.STRING(400))
  pendingEmail: string

  @AllowNull(true)
  @Default(null)
  @Is('UserEmailVerified', value => throwIfNotValid(value, isUserEmailVerifiedValid, 'email verified boolean', true))
  @Column
  emailVerified: boolean

  @AllowNull(false)
  @Is('UserNSFWPolicy', value => throwIfNotValid(value, isUserNSFWPolicyValid, 'NSFW policy'))
  @Column(DataType.ENUM(...Object.values(NSFW_POLICY_TYPES)))
  nsfwPolicy: NSFWPolicyType

  @AllowNull(false)
  @Is('p2pEnabled', value => throwIfNotValid(value, isUserP2PEnabledValid, 'P2P enabled'))
  @Column
  p2pEnabled: boolean

  @AllowNull(false)
  @Default(true)
  @Is('UserVideosHistoryEnabled', value => throwIfNotValid(value, isUserVideosHistoryEnabledValid, 'Videos history enabled'))
  @Column
  videosHistoryEnabled: boolean

  @AllowNull(false)
  @Default(true)
  @Is('UserAutoPlayVideo', value => throwIfNotValid(value, isUserAutoPlayVideoValid, 'auto play video boolean'))
  @Column
  autoPlayVideo: boolean

  @AllowNull(false)
  @Default(false)
  @Is('UserAutoPlayNextVideo', value => throwIfNotValid(value, isUserAutoPlayNextVideoValid, 'auto play next video boolean'))
  @Column
  autoPlayNextVideo: boolean

  @AllowNull(false)
  @Default(true)
  @Is(
    'UserAutoPlayNextVideoPlaylist',
    value => throwIfNotValid(value, isUserAutoPlayNextVideoPlaylistValid, 'auto play next video for playlists boolean')
  )
  @Column
  autoPlayNextVideoPlaylist: boolean

  @AllowNull(true)
  @Default(null)
  @Is('UserVideoLanguages', value => throwIfNotValid(value, isUserVideoLanguages, 'video languages'))
  @Column(DataType.ARRAY(DataType.STRING))
  videoLanguages: string[]

  @AllowNull(false)
  @Default(UserAdminFlag.NONE)
  @Is('UserAdminFlags', value => throwIfNotValid(value, isUserAdminFlagsValid, 'user admin flags'))
  @Column
  adminFlags?: UserAdminFlagType

  @AllowNull(false)
  @Default(false)
  @Is('UserBlocked', value => throwIfNotValid(value, isUserBlockedValid, 'blocked boolean'))
  @Column
  blocked: boolean

  @AllowNull(true)
  @Default(null)
  @Is('UserBlockedReason', value => throwIfNotValid(value, isUserBlockedReasonValid, 'blocked reason', true))
  @Column
  blockedReason: string

  @AllowNull(false)
  @Is('UserRole', value => throwIfNotValid(value, isUserRoleValid, 'role'))
  @Column
  role: UserRoleType

  @AllowNull(false)
  @Is('UserVideoQuota', value => throwIfNotValid(value, isUserVideoQuotaValid, 'video quota'))
  @Column(DataType.BIGINT)
  videoQuota: number

  @AllowNull(false)
  @Is('UserVideoQuotaDaily', value => throwIfNotValid(value, isUserVideoQuotaDailyValid, 'video quota daily'))
  @Column(DataType.BIGINT)
  videoQuotaDaily: number

  @AllowNull(false)
  @Default(DEFAULT_USER_THEME_NAME)
  @Is('UserTheme', value => throwIfNotValid(value, isThemeNameValid, 'theme'))
  @Column
  theme: string

  @AllowNull(false)
  @Default(false)
  @Is(
    'UserNoInstanceConfigWarningModal',
    value => throwIfNotValid(value, isUserNoModal, 'no instance config warning modal')
  )
  @Column
  noInstanceConfigWarningModal: boolean

  @AllowNull(false)
  @Default(false)
  @Is(
    'UserNoWelcomeModal',
    value => throwIfNotValid(value, isUserNoModal, 'no welcome modal')
  )
  @Column
  noWelcomeModal: boolean

  @AllowNull(false)
  @Default(false)
  @Is(
    'UserNoAccountSetupWarningModal',
    value => throwIfNotValid(value, isUserNoModal, 'no account setup warning modal')
  )
  @Column
  noAccountSetupWarningModal: boolean

  @AllowNull(true)
  @Default(null)
  @Column
  pluginAuth: string

  @AllowNull(false)
  @Default(DataType.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  feedToken: string

  @AllowNull(true)
  @Default(null)
  @Column
  lastLoginDate: Date

  @AllowNull(false)
  @Default(false)
  @Column
  emailPublic: boolean

  @AllowNull(true)
  @Default(null)
  @Column
  otpSecret: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @HasOne(() => AccountModel, {
    foreignKey: 'userId',
    onDelete: 'cascade',
    hooks: true
  })
  Account: Awaited<AccountModel>

  @HasOne(() => UserNotificationSettingModel, {
    foreignKey: 'userId',
    onDelete: 'cascade',
    hooks: true
  })
  NotificationSetting: Awaited<UserNotificationSettingModel>

  @HasMany(() => VideoImportModel, {
    foreignKey: 'userId',
    onDelete: 'cascade'
  })
  VideoImports: Awaited<VideoImportModel>[]

  @HasMany(() => OAuthTokenModel, {
    foreignKey: 'userId',
    onDelete: 'cascade'
  })
  OAuthTokens: Awaited<OAuthTokenModel>[]

  @HasMany(() => UserExportModel, {
    foreignKey: 'userId',
    onDelete: 'cascade',
    hooks: true
  })
  UserExports: Awaited<UserExportModel>[]

  // Used if we already set an encrypted password in user model
  skipPasswordEncryption = false

  @BeforeCreate
  @BeforeUpdate
  static async cryptPasswordIfNeeded (instance: UserModel) {
    if (instance.skipPasswordEncryption) return
    if (!instance.changed('password')) return
    if (!instance.password) return

    instance.password = await cryptPassword(instance.password)
  }

  @AfterUpdate
  @AfterDestroy
  static removeTokenCache (instance: UserModel) {
    return TokensCache.Instance.clearCacheByUserId(instance.id)
  }

  static countTotal () {
    return UserModel.unscoped().count()
  }

  static listForAdminApi (parameters: {
    start: number
    count: number
    sort: string
    search?: string
    blocked?: boolean
  }) {
    const { start, count, sort, search, blocked } = parameters
    const where: WhereOptions = {}

    if (search) {
      Object.assign(where, {
        [Op.or]: [
          {
            email: {
              [Op.iLike]: '%' + search + '%'
            }
          },
          {
            username: {
              [Op.iLike]: '%' + search + '%'
            }
          }
        ]
      })
    }

    if (blocked !== undefined) {
      Object.assign(where, { blocked })
    }

    const query: FindOptions = {
      offset: start,
      limit: count,
      order: getAdminUsersSort(sort),
      where
    }

    return Promise.all([
      UserModel.unscoped().count(query),
      UserModel.scope([ 'defaultScope', ScopeNames.WITH_QUOTA, ScopeNames.WITH_TOTAL_FILE_SIZES ]).findAll(query)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static listWithRight (right: UserRightType): Promise<MUserDefault[]> {
    const roles = Object.keys(USER_ROLE_LABELS)
                        .map(k => parseInt(k, 10) as UserRoleType)
                        .filter(role => hasUserRight(role, right))

    const query = {
      where: {
        role: {
          [Op.in]: roles
        }
      }
    }

    return UserModel.findAll(query)
  }

  static listUserSubscribersOf (actorId: number): Promise<MUserWithNotificationSetting[]> {
    const query = {
      include: [
        {
          model: UserNotificationSettingModel.unscoped(),
          required: true
        },
        {
          attributes: [ 'userId' ],
          model: AccountModel.unscoped(),
          required: true,
          include: [
            {
              attributes: [],
              model: ActorModel.unscoped(),
              required: true,
              where: {
                serverId: null
              },
              include: [
                {
                  attributes: [],
                  as: 'ActorFollowings',
                  model: ActorFollowModel.unscoped(),
                  required: true,
                  where: {
                    state: 'accepted',
                    targetActorId: actorId
                  }
                }
              ]
            }
          ]
        }
      ]
    }

    return UserModel.unscoped().findAll(query)
  }

  static listByUsernames (usernames: string[]): Promise<MUserDefault[]> {
    const query = {
      where: {
        username: usernames
      }
    }

    return UserModel.findAll(query)
  }

  static loadById (id: number): Promise<MUser> {
    return UserModel.unscoped().findByPk(id)
  }

  static loadByIdFull (id: number): Promise<MUserDefault> {
    return UserModel.findByPk(id)
  }

  static loadByIdWithChannels (id: number, withStats = false): Promise<MUserDefault> {
    const scopes: (string | ScopeOptions)[] = [ ScopeNames.WITH_VIDEOCHANNELS ]

    if (withStats) {
      const scopeOptions: WhereUserIdScopeOptions = { whereUserId: '$userId' }

      scopes.push({ method: [ ScopeNames.WITH_QUOTA, scopeOptions ] })
      scopes.push({ method: [ ScopeNames.WITH_STATS, scopeOptions ] })
      scopes.push({ method: [ ScopeNames.WITH_TOTAL_FILE_SIZES, scopeOptions ] })
    }

    return UserModel.scope(scopes).findOne({
      where: { id },
      bind: { userId: id }
    })
  }

  static loadByUsername (username: string): Promise<MUserDefault> {
    const query = {
      where: {
        username
      }
    }

    return UserModel.findOne(query)
  }

  static loadForMeAPI (id: number): Promise<MUserNotifSettingChannelDefault> {
    const query = {
      where: {
        id
      }
    }

    return UserModel.scope(ScopeNames.FOR_ME_API).findOne(query)
  }

  static loadByEmailCaseInsensitive (email: string): Promise<MUserDefault[]> {
    const query = {
      where: where(
        fn('LOWER', col('email')),
        '=',
        email.toLowerCase()
      )
    }

    return UserModel.findAll(query)
  }

  static loadByUsernameOrEmailCaseInsensitive (usernameOrEmail: string): Promise<MUserDefault[]> {
    const query = {
      where: {
        [Op.or]: [
          where(fn('lower', col('username')), fn('lower', usernameOrEmail) as any),

          where(fn('lower', col('email')), fn('lower', usernameOrEmail) as any)
        ]
      }
    }

    return UserModel.findAll(query)
  }

  static loadByVideoId (videoId: number): Promise<MUserDefault> {
    const query = {
      include: [
        {
          required: true,
          attributes: [ 'id' ],
          model: AccountModel.unscoped(),
          include: [
            {
              required: true,
              attributes: [ 'id' ],
              model: VideoChannelModel.unscoped(),
              include: [
                {
                  required: true,
                  attributes: [ 'id' ],
                  model: VideoModel.unscoped(),
                  where: {
                    id: videoId
                  }
                }
              ]
            }
          ]
        }
      ]
    }

    return UserModel.findOne(query)
  }

  static loadByVideoImportId (videoImportId: number): Promise<MUserDefault> {
    const query = {
      include: [
        {
          required: true,
          attributes: [ 'id' ],
          model: VideoImportModel.unscoped(),
          where: {
            id: videoImportId
          }
        }
      ]
    }

    return UserModel.findOne(query)
  }

  static loadByChannelActorId (videoChannelActorId: number): Promise<MUserDefault> {
    const query = {
      include: [
        {
          required: true,
          attributes: [ 'id' ],
          model: AccountModel.unscoped(),
          include: [
            {
              required: true,
              attributes: [ 'id' ],
              model: VideoChannelModel.unscoped(),
              where: {
                actorId: videoChannelActorId
              }
            }
          ]
        }
      ]
    }

    return UserModel.findOne(query)
  }

  static loadByAccountId (accountId: number): Promise<MUserDefault> {
    const query = {
      include: [
        {
          required: true,
          attributes: [ 'id' ],
          model: AccountModel.unscoped(),
          where: {
            id: accountId
          }
        }
      ]
    }

    return UserModel.findOne(query)
  }

  static loadByAccountActorId (accountActorId: number): Promise<MUserDefault> {
    const query = {
      include: [
        {
          required: true,
          attributes: [ 'id' ],
          model: AccountModel.unscoped(),
          where: {
            actorId: accountActorId
          }
        }
      ]
    }

    return UserModel.findOne(query)
  }

  static loadByLiveId (liveId: number): Promise<MUser> {
    const query = {
      include: [
        {
          attributes: [ 'id' ],
          model: AccountModel.unscoped(),
          required: true,
          include: [
            {
              attributes: [ 'id' ],
              model: VideoChannelModel.unscoped(),
              required: true,
              include: [
                {
                  attributes: [ 'id' ],
                  model: VideoModel.unscoped(),
                  required: true,
                  include: [
                    {
                      attributes: [],
                      model: VideoLiveModel.unscoped(),
                      required: true,
                      where: {
                        id: liveId
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }

    return UserModel.unscoped().findOne(query)
  }

  static generateUserQuotaBaseSQL (options: {
    daily: boolean
    whereUserId: '$userId' | '"UserModel"."id"'
    onlyMaxResolution: boolean
  }) {
    const { daily, whereUserId, onlyMaxResolution } = options

    const andWhere = daily === true
      ? 'AND "video"."createdAt" > now() - interval \'24 hours\''
      : ''

    const videoChannelJoin = 'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
      'INNER JOIN "account" ON "videoChannel"."accountId" = "account"."id" ' +
      `WHERE "account"."userId" = ${whereUserId} ${andWhere}`

    const webVideoFiles = 'SELECT "videoFile"."size" AS "size", "video"."id" AS "videoId" FROM "videoFile" ' +
      'INNER JOIN "video" ON "videoFile"."videoId" = "video"."id" AND "video"."isLive" IS FALSE ' +
      videoChannelJoin

    const hlsFiles = 'SELECT "videoFile"."size" AS "size", "video"."id" AS "videoId" FROM "videoFile" ' +
      'INNER JOIN "videoStreamingPlaylist" ON "videoFile"."videoStreamingPlaylistId" = "videoStreamingPlaylist".id ' +
      'INNER JOIN "video" ON "videoStreamingPlaylist"."videoId" = "video"."id" AND "video"."isLive" IS FALSE ' +
      videoChannelJoin

    const sizeSelect = onlyMaxResolution
      ? 'MAX("t1"."size")'
      : 'SUM("t1"."size")'

    return 'SELECT COALESCE(SUM("size"), 0) AS "total" ' +
      'FROM (' +
        `SELECT ${sizeSelect} AS "size" FROM (${webVideoFiles} UNION ${hlsFiles}) t1 ` +
        'GROUP BY "t1"."videoId"' +
      ') t2'
  }

  static async getUserQuota (options: {
    userId: number
    daily: boolean
  }) {
    const { daily, userId } = options

    const sql = this.generateUserQuotaBaseSQL({ daily, whereUserId: '$userId', onlyMaxResolution: true })

    const queryOptions = {
      bind: { userId },
      type: QueryTypes.SELECT as QueryTypes.SELECT
    }

    const [ { total } ] = await UserModel.sequelize.query<{ total: string }>(sql, queryOptions)
    if (!total) return 0

    return parseInt(total, 10)
  }

  static getStats () {
    const query = `SELECT ` +
      `COUNT(*) AS "totalUsers", ` +
      `COUNT(*) FILTER (WHERE "lastLoginDate" > NOW() - INTERVAL '1d') AS "totalDailyActiveUsers", ` +
      `COUNT(*) FILTER (WHERE "lastLoginDate" > NOW() - INTERVAL '7d') AS "totalWeeklyActiveUsers", ` +
      `COUNT(*) FILTER (WHERE "lastLoginDate" > NOW() - INTERVAL '30d') AS "totalMonthlyActiveUsers", ` +
      `COUNT(*) FILTER (WHERE "lastLoginDate" > NOW() - INTERVAL '180d') AS "totalHalfYearActiveUsers", ` +
      `COUNT(*) FILTER (WHERE "role" = ${UserRole.MODERATOR}) AS "totalModerators", ` +
      `COUNT(*) FILTER (WHERE "role" = ${UserRole.ADMINISTRATOR}) AS "totalAdmins" ` +
      `FROM "user"`

    return UserModel.sequelize.query<any>(query, {
      type: QueryTypes.SELECT,
      raw: true
    }).then(([ row ]) => {
      return {
        totalUsers: parseAggregateResult(row.totalUsers),
        totalDailyActiveUsers: parseAggregateResult(row.totalDailyActiveUsers),
        totalWeeklyActiveUsers: parseAggregateResult(row.totalWeeklyActiveUsers),
        totalMonthlyActiveUsers: parseAggregateResult(row.totalMonthlyActiveUsers),
        totalHalfYearActiveUsers: parseAggregateResult(row.totalHalfYearActiveUsers),
        totalModerators: parseAggregateResult(row.totalModerators),
        totalAdmins: parseAggregateResult(row.totalAdmins)
      }
    })
  }

  static autoComplete (search: string) {
    const query = {
      where: {
        username: {
          [Op.like]: `%${search}%`
        }
      },
      limit: 10
    }

    return UserModel.findAll(query)
                    .then(u => u.map(u => u.username))
  }

  hasRight (right: UserRightType) {
    return hasUserRight(this.role, right)
  }

  hasAdminFlag (flag: UserAdminFlagType) {
    return this.adminFlags & flag
  }

  isPasswordMatch (password: string) {
    if (!password || !this.password) return false

    return comparePassword(password, this.password)
  }

  toFormattedJSON (this: MUserFormattable, parameters: { withAdminFlags?: boolean } = {}): User {
    const videoQuotaUsed = this.get('videoQuotaUsed')
    const videoQuotaUsedDaily = this.get('videoQuotaUsedDaily')
    const videosCount = this.get('videosCount')
    const [ abusesCount, abusesAcceptedCount ] = (this.get('abusesCount') as string || ':').split(':')
    const abusesCreatedCount = this.get('abusesCreatedCount')
    const videoCommentsCount = this.get('videoCommentsCount')
    const totalVideoFileSize = this.get('totalVideoFileSize')

    const json: User = {
      id: this.id,
      username: this.username,
      email: this.email,
      theme: getThemeOrDefault(this.theme, DEFAULT_USER_THEME_NAME),

      pendingEmail: this.pendingEmail,
      emailPublic: this.emailPublic,
      emailVerified: this.emailVerified,

      nsfwPolicy: this.nsfwPolicy,

      p2pEnabled: this.p2pEnabled,

      videosHistoryEnabled: this.videosHistoryEnabled,
      autoPlayVideo: this.autoPlayVideo,
      autoPlayNextVideo: this.autoPlayNextVideo,
      autoPlayNextVideoPlaylist: this.autoPlayNextVideoPlaylist,
      videoLanguages: this.videoLanguages,

      role: {
        id: this.role,
        label: USER_ROLE_LABELS[this.role]
      },

      videoQuota: this.videoQuota,
      videoQuotaDaily: this.videoQuotaDaily,

      totalVideoFileSize: totalVideoFileSize !== undefined
        ? forceNumber(totalVideoFileSize)
        : undefined,

      videoQuotaUsed: videoQuotaUsed !== undefined
        ? forceNumber(videoQuotaUsed) + LiveQuotaStore.Instance.getLiveQuotaOfUser(this.id)
        : undefined,

      videoQuotaUsedDaily: videoQuotaUsedDaily !== undefined
        ? forceNumber(videoQuotaUsedDaily) + LiveQuotaStore.Instance.getLiveQuotaOfUser(this.id)
        : undefined,

      videosCount: videosCount !== undefined
        ? forceNumber(videosCount)
        : undefined,
      abusesCount: abusesCount
        ? forceNumber(abusesCount)
        : undefined,
      abusesAcceptedCount: abusesAcceptedCount
        ? forceNumber(abusesAcceptedCount)
        : undefined,
      abusesCreatedCount: abusesCreatedCount !== undefined
        ? forceNumber(abusesCreatedCount)
        : undefined,
      videoCommentsCount: videoCommentsCount !== undefined
        ? forceNumber(videoCommentsCount)
        : undefined,

      noInstanceConfigWarningModal: this.noInstanceConfigWarningModal,
      noWelcomeModal: this.noWelcomeModal,
      noAccountSetupWarningModal: this.noAccountSetupWarningModal,

      blocked: this.blocked,
      blockedReason: this.blockedReason,

      account: this.Account.toFormattedJSON(),

      notificationSettings: this.NotificationSetting
        ? this.NotificationSetting.toFormattedJSON()
        : undefined,

      videoChannels: [],

      createdAt: this.createdAt,

      pluginAuth: this.pluginAuth,

      lastLoginDate: this.lastLoginDate,

      twoFactorEnabled: !!this.otpSecret
    }

    if (parameters.withAdminFlags) {
      Object.assign(json, { adminFlags: this.adminFlags })
    }

    if (Array.isArray(this.Account.VideoChannels) === true) {
      json.videoChannels = this.Account.VideoChannels
                               .map(c => c.toFormattedJSON())
                               .sort((v1, v2) => {
                                 if (v1.createdAt < v2.createdAt) return -1
                                 if (v1.createdAt === v2.createdAt) return 0

                                 return 1
                               })
    }

    return json
  }

  toMeFormattedJSON (this: MMyUserFormattable): MyUser {
    const formatted = this.toFormattedJSON({ withAdminFlags: true })

    const specialPlaylists = this.Account.VideoPlaylists
                                 .map(p => ({ id: p.id, name: p.name, type: p.type }))

    return Object.assign(formatted, { specialPlaylists })
  }
}
