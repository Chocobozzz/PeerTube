import * as Sequelize from 'sequelize'
import {
  AfterDelete,
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
import { hasUserRight, USER_ROLE_LABELS, UserRight } from '../../../shared'
import { User, UserRole } from '../../../shared/models/users'
import {
  isUserAutoPlayVideoValid,
  isUserBlockedReasonValid,
  isUserBlockedValid,
  isUserEmailVerifiedValid,
  isUserNSFWPolicyValid,
  isUserPasswordValid,
  isUserRoleValid,
  isUserUsernameValid,
  isUserVideoQuotaDailyValid,
  isUserVideoQuotaValid,
  isUserWebTorrentEnabledValid
} from '../../helpers/custom-validators/users'
import { comparePassword, cryptPassword } from '../../helpers/peertube-crypto'
import { OAuthTokenModel } from '../oauth/oauth-token'
import { getSort, throwIfNotValid } from '../utils'
import { VideoChannelModel } from '../video/video-channel'
import { AccountModel } from './account'
import { NSFWPolicyType } from '../../../shared/models/videos/nsfw-policy.type'
import { values } from 'lodash'
import { NSFW_POLICY_TYPES } from '../../initializers'
import { clearCacheByUserId } from '../../lib/oauth-model'

enum ScopeNames {
  WITH_VIDEO_CHANNEL = 'WITH_VIDEO_CHANNEL'
}

@DefaultScope({
  include: [
    {
      model: () => AccountModel,
      required: true
    }
  ]
})
@Scopes({
  [ScopeNames.WITH_VIDEO_CHANNEL]: {
    include: [
      {
        model: () => AccountModel,
        required: true,
        include: [ () => VideoChannelModel ]
      }
    ]
  }
})
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

  @AllowNull(false)
  @Is('UserPassword', value => throwIfNotValid(value, isUserPasswordValid, 'user password'))
  @Column
  password: string

  @AllowNull(false)
  @Is('UserPassword', value => throwIfNotValid(value, isUserUsernameValid, 'user name'))
  @Column
  username: string

  @AllowNull(false)
  @IsEmail
  @Column(DataType.STRING(400))
  email: string

  @AllowNull(true)
  @Default(null)
  @Is('UserEmailVerified', value => throwIfNotValid(value, isUserEmailVerifiedValid, 'email verified boolean'))
  @Column
  emailVerified: boolean

  @AllowNull(false)
  @Is('UserNSFWPolicy', value => throwIfNotValid(value, isUserNSFWPolicyValid, 'NSFW policy'))
  @Column(DataType.ENUM(values(NSFW_POLICY_TYPES)))
  nsfwPolicy: NSFWPolicyType

  @AllowNull(false)
  @Default(true)
  @Is('UserWebTorrentEnabled', value => throwIfNotValid(value, isUserWebTorrentEnabledValid, 'WebTorrent enabled'))
  @Column
  webTorrentEnabled: boolean

  @AllowNull(false)
  @Default(true)
  @Is('UserAutoPlayVideo', value => throwIfNotValid(value, isUserAutoPlayVideoValid, 'auto play video boolean'))
  @Column
  autoPlayVideo: boolean

  @AllowNull(false)
  @Default(false)
  @Is('UserBlocked', value => throwIfNotValid(value, isUserBlockedValid, 'blocked boolean'))
  @Column
  blocked: boolean

  @AllowNull(true)
  @Default(null)
  @Is('UserBlockedReason', value => throwIfNotValid(value, isUserBlockedReasonValid, 'blocked reason'))
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

  @HasMany(() => OAuthTokenModel, {
    foreignKey: 'userId',
    onDelete: 'cascade'
  })
  OAuthTokens: OAuthTokenModel[]

  @BeforeCreate
  @BeforeUpdate
  static cryptPasswordIfNeeded (instance: UserModel) {
    if (instance.changed('password')) {
      return cryptPassword(instance.password)
        .then(hash => {
          instance.password = hash
          return undefined
        })
    }
  }

  @AfterUpdate
  @AfterDelete
  static removeTokenCache (instance: UserModel) {
    return clearCacheByUserId(instance.id)
  }

  static countTotal () {
    return this.count()
  }

  static listForApi (start: number, count: number, sort: string, search?: string) {
    let where = undefined
    if (search) {
      where = {
        [Sequelize.Op.or]: [
          {
            email: {
              [Sequelize.Op.iLike]: '%' + search + '%'
            }
          },
          {
            username: {
              [ Sequelize.Op.iLike ]: '%' + search + '%'
            }
          }
        ]
      }
    }

    const query = {
      attributes: {
        include: [
          [
            Sequelize.literal(
              '(' +
                'SELECT COALESCE(SUM("size"), 0) ' +
                'FROM (' +
                  'SELECT MAX("videoFile"."size") AS "size" FROM "videoFile" ' +
                  'INNER JOIN "video" ON "videoFile"."videoId" = "video"."id" ' +
                  'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
                  'INNER JOIN "account" ON "videoChannel"."accountId" = "account"."id" ' +
                  'WHERE "account"."userId" = "UserModel"."id" GROUP BY "video"."id"' +
                ') t' +
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

  static listEmailsWithRight (right: UserRight) {
    const roles = Object.keys(USER_ROLE_LABELS)
      .map(k => parseInt(k, 10) as UserRole)
      .filter(role => hasUserRight(role, right))

    const query = {
      attribute: [ 'email' ],
      where: {
        role: {
          [Sequelize.Op.in]: roles
        }
      }
    }

    return UserModel.unscoped()
      .findAll(query)
      .then(u => u.map(u => u.email))
  }

  static loadById (id: number) {
    return UserModel.findById(id)
  }

  static loadByUsername (username: string) {
    const query = {
      where: {
        username
      }
    }

    return UserModel.findOne(query)
  }

  static loadByUsernameAndPopulateChannels (username: string) {
    const query = {
      where: {
        username
      }
    }

    return UserModel.scope(ScopeNames.WITH_VIDEO_CHANNEL).findOne(query)
  }

  static loadByEmail (email: string) {
    const query = {
      where: {
        email
      }
    }

    return UserModel.findOne(query)
  }

  static loadByUsernameOrEmail (username: string, email?: string) {
    if (!email) email = username

    const query = {
      where: {
        [ Sequelize.Op.or ]: [ { username }, { email } ]
      }
    }

    return UserModel.findOne(query)
  }

  static getOriginalVideoFileTotalFromUser (user: UserModel) {
    // Don't use sequelize because we need to use a sub query
    const query = UserModel.generateUserQuotaBaseSQL()

    return UserModel.getTotalRawQuery(query, user.id)
  }

  // Returns cumulative size of all video files uploaded in the last 24 hours.
  static getOriginalVideoFileTotalDailyFromUser (user: UserModel) {
    // Don't use sequelize because we need to use a sub query
    const query = UserModel.generateUserQuotaBaseSQL('"video"."createdAt" > now() - interval \'24 hours\'')

    return UserModel.getTotalRawQuery(query, user.id)
  }

  static async getStats () {
    const totalUsers = await UserModel.count()

    return {
      totalUsers
    }
  }

  static autoComplete (search: string) {
    const query = {
      where: {
        username: {
          [ Sequelize.Op.like ]: `%${search}%`
        }
      },
      limit: 10
    }

    return UserModel.findAll(query)
                    .then(u => u.map(u => u.username))
  }

  hasRight (right: UserRight) {
    return hasUserRight(this.role, right)
  }

  isPasswordMatch (password: string) {
    return comparePassword(password, this.password)
  }

  toFormattedJSON (): User {
    const videoQuotaUsed = this.get('videoQuotaUsed')
    const videoQuotaUsedDaily = this.get('videoQuotaUsedDaily')

    const json = {
      id: this.id,
      username: this.username,
      email: this.email,
      emailVerified: this.emailVerified,
      nsfwPolicy: this.nsfwPolicy,
      webTorrentEnabled: this.webTorrentEnabled,
      autoPlayVideo: this.autoPlayVideo,
      role: this.role,
      roleLabel: USER_ROLE_LABELS[ this.role ],
      videoQuota: this.videoQuota,
      videoQuotaDaily: this.videoQuotaDaily,
      createdAt: this.createdAt,
      blocked: this.blocked,
      blockedReason: this.blockedReason,
      account: this.Account.toFormattedJSON(),
      videoChannels: [],
      videoQuotaUsed: videoQuotaUsed !== undefined
            ? parseInt(videoQuotaUsed, 10)
            : undefined,
      videoQuotaUsedDaily: videoQuotaUsedDaily !== undefined
            ? parseInt(videoQuotaUsedDaily, 10)
            : undefined
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

  async isAbleToUploadVideo (videoFile: { size: number }) {
    if (this.videoQuota === -1 && this.videoQuotaDaily === -1) return Promise.resolve(true)

    const [ totalBytes, totalBytesDaily ] = await Promise.all([
      UserModel.getOriginalVideoFileTotalFromUser(this),
      UserModel.getOriginalVideoFileTotalDailyFromUser(this)
    ])

    const uploadedTotal = videoFile.size + totalBytes
    const uploadedDaily = videoFile.size + totalBytesDaily
    if (this.videoQuotaDaily === -1) {
      return uploadedTotal < this.videoQuota
    }
    if (this.videoQuota === -1) {
      return uploadedDaily < this.videoQuotaDaily
    }

    return (uploadedTotal < this.videoQuota) &&
        (uploadedDaily < this.videoQuotaDaily)
  }

  private static generateUserQuotaBaseSQL (where?: string) {
    const andWhere = where ? 'AND ' + where : ''

    return 'SELECT SUM("size") AS "total" ' +
      'FROM (' +
        'SELECT MAX("videoFile"."size") AS "size" FROM "videoFile" ' +
        'INNER JOIN "video" ON "videoFile"."videoId" = "video"."id" ' +
        'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
        'INNER JOIN "account" ON "videoChannel"."accountId" = "account"."id" ' +
        'WHERE "account"."userId" = $userId ' + andWhere +
        'GROUP BY "video"."id"' +
      ') t'
  }

  private static getTotalRawQuery (query: string, userId: number) {
    const options = {
      bind: { userId },
      type: Sequelize.QueryTypes.SELECT
    }

    return UserModel.sequelize.query(query, options)
                    .then(([ { total } ]) => {
                      if (total === null) return 0

                      return parseInt(total, 10)
                    })
  }
}
