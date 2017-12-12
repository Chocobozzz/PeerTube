import * as Sequelize from 'sequelize'
import {
  AllowNull,
  BeforeCreate,
  BeforeUpdate,
  Column, CreatedAt,
  DataType,
  Default,
  HasMany,
  HasOne,
  Is,
  IsEmail,
  Model,
  Table, UpdatedAt
} from 'sequelize-typescript'
import { hasUserRight, USER_ROLE_LABELS, UserRight } from '../../../shared'
import {
  comparePassword,
  cryptPassword
} from '../../helpers'
import {
  isUserDisplayNSFWValid, isUserPasswordValid, isUserRoleValid, isUserUsernameValid,
  isUserVideoQuotaValid
} from '../../helpers/custom-validators/users'
import { OAuthTokenModel } from '../oauth/oauth-token'
import { getSort, throwIfNotValid } from '../utils'
import { VideoChannelModel } from '../video/video-channel'
import { AccountModel } from './account'

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
  @Default(false)
  @Is('UserDisplayNSFW', value => throwIfNotValid(value, isUserDisplayNSFWValid, 'display NSFW boolean'))
  @Column
  displayNSFW: boolean

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
    onDelete: 'cascade'
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

  static getByUsername (username: string) {
    const query = {
      where: {
        username: username
      },
      include: [ { model: AccountModel, required: true } ]
    }

    return UserModel.findOne(query)
  }

  static listForApi (start: number, count: number, sort: string) {
    const query = {
      offset: start,
      limit: count,
      order: [ getSort(sort) ],
      include: [ { model: AccountModel, required: true } ]
    }

    return UserModel.findAndCountAll(query)
      .then(({ rows, count }) => {
        return {
          data: rows,
          total: count
        }
      })
  }

  static loadById (id: number) {
    const options = {
      include: [ { model: AccountModel, required: true } ]
    }

    return UserModel.findById(id, options)
  }

  static loadByUsername (username: string) {
    const query = {
      where: {
        username
      },
      include: [ { model: AccountModel, required: true } ]
    }

    return UserModel.findOne(query)
  }

  static loadByUsernameAndPopulateChannels (username: string) {
    const query = {
      where: {
        username
      },
      include: [
        {
          model: AccountModel,
          required: true,
          include: [ VideoChannelModel ]
        }
      ]
    }

    return UserModel.findOne(query)
  }

  static loadByUsernameOrEmail (username: string, email: string) {
    const query = {
      include: [ { model: AccountModel, required: true } ],
      where: {
        [ Sequelize.Op.or ]: [ { username }, { email } ]
      }
    }

    // FIXME: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/18387
    return (UserModel as any).findOne(query)
  }

  private static getOriginalVideoFileTotalFromUser (user: UserModel) {
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

  hasRight (right: UserRight) {
    return hasUserRight(this.role, right)
  }

  isPasswordMatch (password: string) {
    return comparePassword(password, this.password)
  }

  toFormattedJSON () {
    const json = {
      id: this.id,
      username: this.username,
      email: this.email,
      displayNSFW: this.displayNSFW,
      role: this.role,
      roleLabel: USER_ROLE_LABELS[ this.role ],
      videoQuota: this.videoQuota,
      createdAt: this.createdAt,
      account: this.Account.toFormattedJSON()
    }

    if (Array.isArray(this.Account.VideoChannels) === true) {
      json['videoChannels'] = this.Account.VideoChannels
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
