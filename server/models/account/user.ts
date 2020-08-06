import * as Bluebird from 'bluebird'
import { values } from 'lodash'
import { col, FindOptions, fn, literal, Op, QueryTypes, where, WhereOptions } from 'sequelize'
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
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import {
  MMyUserFormattable,
  MUserDefault,
  MUserFormattable,
  MUserId,
  MUserNotifSettingChannelDefault,
  MUserWithNotificationSetting,
  MVideoFullLight
} from '@server/types/models'
import { hasUserRight, USER_ROLE_LABELS } from '../../../shared/core-utils/users'
import { AbuseState, MyUser, UserRight, VideoPlaylistType, VideoPrivacy } from '../../../shared/models'
import { User, UserRole } from '../../../shared/models/users'
import { UserAdminFlag } from '../../../shared/models/users/user-flag.model'
import { NSFWPolicyType } from '../../../shared/models/videos/nsfw-policy.type'
import { isThemeNameValid } from '../../helpers/custom-validators/plugins'
import {
  isNoInstanceConfigWarningModal,
  isNoWelcomeModal,
  isUserAdminFlagsValid,
  isUserAutoPlayNextVideoPlaylistValid,
  isUserAutoPlayNextVideoValid,
  isUserAutoPlayVideoValid,
  isUserBlockedReasonValid,
  isUserBlockedValid,
  isUserEmailVerifiedValid,
  isUserNSFWPolicyValid,
  isUserPasswordValid,
  isUserRoleValid,
  isUserUsernameValid,
  isUserVideoLanguages,
  isUserVideoQuotaDailyValid,
  isUserVideoQuotaValid,
  isUserVideosHistoryEnabledValid,
  isUserWebTorrentEnabledValid
} from '../../helpers/custom-validators/users'
import { comparePassword, cryptPassword } from '../../helpers/peertube-crypto'
import { DEFAULT_USER_THEME_NAME, NSFW_POLICY_TYPES } from '../../initializers/constants'
import { clearCacheByUserId } from '../../lib/oauth-model'
import { getThemeOrDefault } from '../../lib/plugins/theme-utils'
import { ActorModel } from '../activitypub/actor'
import { ActorFollowModel } from '../activitypub/actor-follow'
import { OAuthTokenModel } from '../oauth/oauth-token'
import { getSort, throwIfNotValid } from '../utils'
import { VideoModel } from '../video/video'
import { VideoChannelModel } from '../video/video-channel'
import { VideoImportModel } from '../video/video-import'
import { VideoPlaylistModel } from '../video/video-playlist'
import { AccountModel } from './account'
import { UserNotificationSettingModel } from './user-notification-setting'

enum ScopeNames {
  FOR_ME_API = 'FOR_ME_API',
  WITH_VIDEOCHANNELS = 'WITH_VIDEOCHANNELS',
  WITH_STATS = 'WITH_STATS'
}

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
  [ScopeNames.WITH_STATS]: {
    attributes: {
      include: [
        [
          literal(
            '(' +
              UserModel.generateUserQuotaBaseSQL({
                withSelect: false,
                whereUserId: '"UserModel"."id"'
              }) +
            ')'
          ),
          'videoQuotaUsed'
        ],
        [
          literal(
            '(' +
              'SELECT COUNT("video"."id") ' +
              'FROM "video" ' +
              'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
              'INNER JOIN "account" ON "account"."id" = "videoChannel"."accountId" ' +
              'WHERE "account"."userId" = "UserModel"."id"' +
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
                'WHERE "account"."userId" = "UserModel"."id"' +
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
              'WHERE "account"."userId" = "UserModel"."id"' +
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
              'WHERE "account"."userId" = "UserModel"."id"' +
            ')'
          ),
          'videoCommentsCount'
        ]
      ]
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
export class UserModel extends Model<UserModel> {

  @AllowNull(true)
  @Is('UserPassword', value => throwIfNotValid(value, isUserPasswordValid, 'user password', true))
  @Column
  password: string

  @AllowNull(false)
  @Is('UserUsername', value => throwIfNotValid(value, isUserUsernameValid, 'user name'))
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
  @Column(DataType.ENUM(...values(NSFW_POLICY_TYPES)))
  nsfwPolicy: NSFWPolicyType

  @AllowNull(false)
  @Default(true)
  @Is('UserWebTorrentEnabled', value => throwIfNotValid(value, isUserWebTorrentEnabledValid, 'WebTorrent enabled'))
  @Column
  webTorrentEnabled: boolean

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
  adminFlags?: UserAdminFlag

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
  role: number

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
    value => throwIfNotValid(value, isNoInstanceConfigWarningModal, 'no instance config warning modal')
  )
  @Column
  noInstanceConfigWarningModal: boolean

  @AllowNull(false)
  @Default(false)
  @Is(
    'UserNoInstanceConfigWarningModal',
    value => throwIfNotValid(value, isNoWelcomeModal, 'no welcome modal')
  )
  @Column
  noWelcomeModal: boolean

  @AllowNull(true)
  @Default(null)
  @Column
  pluginAuth: string

  @AllowNull(true)
  @Default(null)
  @Column
  lastLoginDate: Date

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @HasOne(() => AccountModel, {
    foreignKey: 'userId',
    onDelete: 'cascade',
    hooks: true
  })
  Account: AccountModel

  @HasOne(() => UserNotificationSettingModel, {
    foreignKey: 'userId',
    onDelete: 'cascade',
    hooks: true
  })
  NotificationSetting: UserNotificationSettingModel

  @HasMany(() => VideoImportModel, {
    foreignKey: 'userId',
    onDelete: 'cascade'
  })
  VideoImports: VideoImportModel[]

  @HasMany(() => OAuthTokenModel, {
    foreignKey: 'userId',
    onDelete: 'cascade'
  })
  OAuthTokens: OAuthTokenModel[]

  @BeforeCreate
  @BeforeUpdate
  static cryptPasswordIfNeeded (instance: UserModel) {
    if (instance.changed('password') && instance.password) {
      return cryptPassword(instance.password)
        .then(hash => {
          instance.password = hash
          return undefined
        })
    }
  }

  @AfterUpdate
  @AfterDestroy
  static removeTokenCache (instance: UserModel) {
    return clearCacheByUserId(instance.id)
  }

  static countTotal () {
    return this.count()
  }

  static listForApi (parameters: {
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
      Object.assign(where, {
        blocked: blocked
      })
    }

    const query: FindOptions = {
      attributes: {
        include: [
          [
            literal(
              '(' +
                UserModel.generateUserQuotaBaseSQL({
                  withSelect: false,
                  whereUserId: '"UserModel"."id"'
                }) +
              ')'
            ),
            'videoQuotaUsed'
          ] as any // FIXME: typings
        ]
      },
      offset: start,
      limit: count,
      order: getSort(sort),
      where
    }

    return UserModel.findAndCountAll(query)
                    .then(({ rows, count }) => {
                      return {
                        data: rows,
                        total: count
                      }
                    })
  }

  static listWithRight (right: UserRight): Bluebird<MUserDefault[]> {
    const roles = Object.keys(USER_ROLE_LABELS)
                        .map(k => parseInt(k, 10) as UserRole)
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

  static listUserSubscribersOf (actorId: number): Bluebird<MUserWithNotificationSetting[]> {
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

  static listByUsernames (usernames: string[]): Bluebird<MUserDefault[]> {
    const query = {
      where: {
        username: usernames
      }
    }

    return UserModel.findAll(query)
  }

  static loadById (id: number, withStats = false): Bluebird<MUserDefault> {
    const scopes = [
      ScopeNames.WITH_VIDEOCHANNELS
    ]

    if (withStats) scopes.push(ScopeNames.WITH_STATS)

    return UserModel.scope(scopes).findByPk(id)
  }

  static loadByUsername (username: string): Bluebird<MUserDefault> {
    const query = {
      where: {
        username: { [Op.iLike]: username }
      }
    }

    return UserModel.findOne(query)
  }

  static loadForMeAPI (username: string): Bluebird<MUserNotifSettingChannelDefault> {
    const query = {
      where: {
        username: { [Op.iLike]: username }
      }
    }

    return UserModel.scope(ScopeNames.FOR_ME_API).findOne(query)
  }

  static loadByEmail (email: string): Bluebird<MUserDefault> {
    const query = {
      where: {
        email
      }
    }

    return UserModel.findOne(query)
  }

  static loadByUsernameOrEmail (username: string, email?: string): Bluebird<MUserDefault> {
    if (!email) email = username

    const query = {
      where: {
        [Op.or]: [
          where(fn('lower', col('username')), fn('lower', username)),

          { email }
        ]
      }
    }

    return UserModel.findOne(query)
  }

  static loadByVideoId (videoId: number): Bluebird<MUserDefault> {
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

  static loadByVideoImportId (videoImportId: number): Bluebird<MUserDefault> {
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

  static loadByChannelActorId (videoChannelActorId: number): Bluebird<MUserDefault> {
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

  static loadByAccountActorId (accountActorId: number): Bluebird<MUserDefault> {
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

  static getOriginalVideoFileTotalFromUser (user: MUserId) {
    // Don't use sequelize because we need to use a sub query
    const query = UserModel.generateUserQuotaBaseSQL({
      withSelect: true,
      whereUserId: '$userId'
    })

    return UserModel.getTotalRawQuery(query, user.id)
  }

  // Returns cumulative size of all video files uploaded in the last 24 hours.
  static getOriginalVideoFileTotalDailyFromUser (user: MUserId) {
    // Don't use sequelize because we need to use a sub query
    const query = UserModel.generateUserQuotaBaseSQL({
      withSelect: true,
      whereUserId: '$userId',
      where: '"video"."createdAt" > now() - interval \'24 hours\''
    })

    return UserModel.getTotalRawQuery(query, user.id)
  }

  static async getStats () {
    function getActiveUsers (days: number) {
      const query = {
        where: {
          [Op.and]: [
            literal(`"lastLoginDate" > NOW() - INTERVAL '${days}d'`)
          ]
        }
      }

      return UserModel.count(query)
    }

    const totalUsers = await UserModel.count()
    const totalDailyActiveUsers = await getActiveUsers(1)
    const totalWeeklyActiveUsers = await getActiveUsers(7)
    const totalMonthlyActiveUsers = await getActiveUsers(30)

    return {
      totalUsers,
      totalDailyActiveUsers,
      totalWeeklyActiveUsers,
      totalMonthlyActiveUsers
    }
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

  canGetVideo (video: MVideoFullLight) {
    const videoUserId = video.VideoChannel.Account.userId

    if (video.isBlacklisted()) {
      return videoUserId === this.id || this.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST)
    }

    if (video.privacy === VideoPrivacy.PRIVATE) {
      return video.VideoChannel && videoUserId === this.id || this.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST)
    }

    if (video.privacy === VideoPrivacy.INTERNAL) return true

    return false
  }

  hasRight (right: UserRight) {
    return hasUserRight(this.role, right)
  }

  hasAdminFlag (flag: UserAdminFlag) {
    return this.adminFlags & flag
  }

  isPasswordMatch (password: string) {
    return comparePassword(password, this.password)
  }

  toFormattedJSON (this: MUserFormattable, parameters: { withAdminFlags?: boolean } = {}): User {
    const videoQuotaUsed = this.get('videoQuotaUsed')
    const videoQuotaUsedDaily = this.get('videoQuotaUsedDaily')
    const videosCount = this.get('videosCount')
    const [ abusesCount, abusesAcceptedCount ] = (this.get('abusesCount') as string || ':').split(':')
    const abusesCreatedCount = this.get('abusesCreatedCount')
    const videoCommentsCount = this.get('videoCommentsCount')

    const json: User = {
      id: this.id,
      username: this.username,
      email: this.email,
      theme: getThemeOrDefault(this.theme, DEFAULT_USER_THEME_NAME),

      pendingEmail: this.pendingEmail,
      emailVerified: this.emailVerified,

      nsfwPolicy: this.nsfwPolicy,
      webTorrentEnabled: this.webTorrentEnabled,
      videosHistoryEnabled: this.videosHistoryEnabled,
      autoPlayVideo: this.autoPlayVideo,
      autoPlayNextVideo: this.autoPlayNextVideo,
      autoPlayNextVideoPlaylist: this.autoPlayNextVideoPlaylist,
      videoLanguages: this.videoLanguages,

      role: this.role,
      roleLabel: USER_ROLE_LABELS[this.role],

      videoQuota: this.videoQuota,
      videoQuotaDaily: this.videoQuotaDaily,
      videoQuotaUsed: videoQuotaUsed !== undefined
        ? parseInt(videoQuotaUsed + '', 10)
        : undefined,
      videoQuotaUsedDaily: videoQuotaUsedDaily !== undefined
        ? parseInt(videoQuotaUsedDaily + '', 10)
        : undefined,
      videosCount: videosCount !== undefined
        ? parseInt(videosCount + '', 10)
        : undefined,
      abusesCount: abusesCount
        ? parseInt(abusesCount, 10)
        : undefined,
      abusesAcceptedCount: abusesAcceptedCount
        ? parseInt(abusesAcceptedCount, 10)
        : undefined,
      abusesCreatedCount: abusesCreatedCount !== undefined
        ? parseInt(abusesCreatedCount + '', 10)
        : undefined,
      videoCommentsCount: videoCommentsCount !== undefined
        ? parseInt(videoCommentsCount + '', 10)
        : undefined,

      noInstanceConfigWarningModal: this.noInstanceConfigWarningModal,
      noWelcomeModal: this.noWelcomeModal,

      blocked: this.blocked,
      blockedReason: this.blockedReason,

      account: this.Account.toFormattedJSON(),

      notificationSettings: this.NotificationSetting
        ? this.NotificationSetting.toFormattedJSON()
        : undefined,

      videoChannels: [],

      createdAt: this.createdAt,

      pluginAuth: this.pluginAuth,

      lastLoginDate: this.lastLoginDate
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
    const formatted = this.toFormattedJSON()

    const specialPlaylists = this.Account.VideoPlaylists
                                 .map(p => ({ id: p.id, name: p.name, type: p.type }))

    return Object.assign(formatted, { specialPlaylists })
  }

  async isAbleToUploadVideo (videoFile: { size: number }) {
    if (this.videoQuota === -1 && this.videoQuotaDaily === -1) return Promise.resolve(true)

    const [ totalBytes, totalBytesDaily ] = await Promise.all([
      UserModel.getOriginalVideoFileTotalFromUser(this),
      UserModel.getOriginalVideoFileTotalDailyFromUser(this)
    ])

    const uploadedTotal = videoFile.size + totalBytes
    const uploadedDaily = videoFile.size + totalBytesDaily

    if (this.videoQuotaDaily === -1) return uploadedTotal < this.videoQuota
    if (this.videoQuota === -1) return uploadedDaily < this.videoQuotaDaily

    return uploadedTotal < this.videoQuota && uploadedDaily < this.videoQuotaDaily
  }

  private static generateUserQuotaBaseSQL (options: {
    whereUserId: '$userId' | '"UserModel"."id"'
    withSelect: boolean
    where?: string
  }) {
    const andWhere = options.where
      ? 'AND ' + options.where
      : ''

    const videoChannelJoin = 'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
      'INNER JOIN "account" ON "videoChannel"."accountId" = "account"."id" ' +
      `WHERE "account"."userId" = ${options.whereUserId} ${andWhere}`

    const webtorrentFiles = 'SELECT "videoFile"."size" AS "size", "video"."id" AS "videoId" FROM "videoFile" ' +
      'INNER JOIN "video" ON "videoFile"."videoId" = "video"."id" ' +
      videoChannelJoin

    const hlsFiles = 'SELECT "videoFile"."size" AS "size", "video"."id" AS "videoId" FROM "videoFile" ' +
      'INNER JOIN "videoStreamingPlaylist" ON "videoFile"."videoStreamingPlaylistId" = "videoStreamingPlaylist".id ' +
      'INNER JOIN "video" ON "videoStreamingPlaylist"."videoId" = "video"."id" ' +
      videoChannelJoin

    return 'SELECT COALESCE(SUM("size"), 0) AS "total" ' +
      'FROM (' +
        `SELECT MAX("t1"."size") AS "size" FROM (${webtorrentFiles} UNION ${hlsFiles}) t1 ` +
        'GROUP BY "t1"."videoId"' +
      ') t2'
  }

  private static getTotalRawQuery (query: string, userId: number) {
    const options = {
      bind: { userId },
      type: QueryTypes.SELECT as QueryTypes.SELECT
    }

    return UserModel.sequelize.query<{ total: string }>(query, options)
                    .then(([ { total } ]) => {
                      if (total === null) return 0

                      return parseInt(total, 10)
                    })
  }
}
