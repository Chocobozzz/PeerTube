import * as Sequelize from 'sequelize'
import {
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
  isUserNSFWPolicyValid,
  isUserPasswordValid,
  isUserRoleValid,
  isUserUsernameValid,
  isUserVideoQuotaValid
} from '../../helpers/custom-validators/users'
import { comparePassword, cryptPassword } from '../../helpers/peertube-crypto'
import { OAuthTokenModel } from '../oauth/oauth-token'
import { getSort, throwIfNotValid } from '../utils'
import { VideoChannelModel } from '../video/video-channel'
import { AccountModel } from './account'
import { NSFWPolicyType } from '../../../shared/models/videos/nsfw-policy.type'
import { values } from 'lodash'
import { NSFW_POLICY_TYPES } from '../../initializers'

@DefaultScope({
  include: [
    {
      model: () => AccountModel,
      required: true
    }
  ]
})
@Scopes({
  withVideoChannel: {
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

  @AllowNull(false)
  @Is('UserNSFWPolicy', value => throwIfNotValid(value, isUserNSFWPolicyValid, 'NSFW policy'))
  @Column(DataType.ENUM(values(NSFW_POLICY_TYPES)))
  nsfwPolicy: NSFWPolicyType

  @AllowNull(false)
  @Default(true)
  @Is('UserAutoPlayVideo', value => throwIfNotValid(value, isUserAutoPlayVideoValid, 'auto play video boolean'))
  @Column
  autoPlayVideo: boolean

  @AllowNull(false)
  @Is('UserRole', value => throwIfNotValid(value, isUserRoleValid, 'role'))
  @Column
  role: number

  @AllowNull(false)
  @Is('UserVideoQuota', value => throwIfNotValid(value, isUserVideoQuotaValid, 'video quota'))
  @Column(DataType.BIGINT)
  videoQuota: number

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

  static countTotal () {
    return this.count()
  }

  static listForApi (start: number, count: number, sort: string) {
    const query = {
      offset: start,
      limit: count,
      order: getSort(sort)
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

    console.log(roles)

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

    return UserModel.scope('withVideoChannel').findOne(query)
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
    const query = 'SELECT SUM("size") AS "total" FROM ' +
      '(SELECT MAX("videoFile"."size") AS "size" FROM "videoFile" ' +
      'INNER JOIN "video" ON "videoFile"."videoId" = "video"."id" ' +
      'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
      'INNER JOIN "account" ON "videoChannel"."accountId" = "account"."id" ' +
      'INNER JOIN "user" ON "account"."userId" = "user"."id" ' +
      'WHERE "user"."id" = $userId GROUP BY "video"."id") t'

    const options = {
      bind: { userId: user.id },
      type: Sequelize.QueryTypes.SELECT
    }
    return UserModel.sequelize.query(query, options)
      .then(([ { total } ]) => {
        if (total === null) return 0

        return parseInt(total, 10)
      })
  }

  static async getStats () {
    const totalUsers = await UserModel.count()

    return {
      totalUsers
    }
  }

  hasRight (right: UserRight) {
    return hasUserRight(this.role, right)
  }

  isPasswordMatch (password: string) {
    return comparePassword(password, this.password)
  }

  toFormattedJSON (): User {
    const json = {
      id: this.id,
      username: this.username,
      email: this.email,
      nsfwPolicy: this.nsfwPolicy,
      autoPlayVideo: this.autoPlayVideo,
      role: this.role,
      roleLabel: USER_ROLE_LABELS[ this.role ],
      videoQuota: this.videoQuota,
      createdAt: this.createdAt,
      account: this.Account.toFormattedJSON(),
      videoChannels: []
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

  isAbleToUploadVideo (videoFile: Express.Multer.File) {
    if (this.videoQuota === -1) return Promise.resolve(true)

    return UserModel.getOriginalVideoFileTotalFromUser(this)
      .then(totalBytes => {
        return (videoFile.size + totalBytes) < this.videoQuota
      })
  }
}
