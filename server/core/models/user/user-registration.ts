import { forceNumber } from '@peertube/peertube-core-utils'
import { UserRegistration, UserRegistrationState, type UserRegistrationStateType } from '@peertube/peertube-models'
import {
  isRegistrationModerationResponseValid,
  isRegistrationReasonValid,
  isRegistrationStateValid
} from '@server/helpers/custom-validators/user-registration.js'
import { isVideoChannelDisplayNameValid } from '@server/helpers/custom-validators/video-channels.js'
import { cryptPassword } from '@server/helpers/peertube-crypto.js'
import { USER_REGISTRATION_STATES } from '@server/initializers/constants.js'
import { MRegistration, MRegistrationFormattable } from '@server/types/models/index.js'
import { col, FindOptions, fn, Op, QueryTypes, where, WhereOptions } from 'sequelize'
import {
  AllowNull,
  BeforeCreate,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Is,
  IsEmail,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isUserDisplayNameValid, isUserEmailVerifiedValid } from '../../helpers/custom-validators/users.js'
import { getSort, parseAggregateResult, SequelizeModel, throwIfNotValid } from '../shared/index.js'
import { UserModel } from './user.js'

@Table({
  tableName: 'userRegistration',
  indexes: [
    {
      fields: [ 'username' ],
      unique: true
    },
    {
      fields: [ 'email' ],
      unique: true
    },
    {
      fields: [ 'channelHandle' ],
      unique: true
    },
    {
      fields: [ 'userId' ],
      unique: true
    }
  ]
})
export class UserRegistrationModel extends SequelizeModel<UserRegistrationModel> {
  @AllowNull(false)
  @Is('RegistrationState', value => throwIfNotValid(value, isRegistrationStateValid, 'state'))
  @Column
  declare state: UserRegistrationStateType

  @AllowNull(false)
  @Is('RegistrationReason', value => throwIfNotValid(value, isRegistrationReasonValid, 'registration reason'))
  @Column(DataType.TEXT)
  declare registrationReason: string

  @AllowNull(true)
  @Is('RegistrationModerationResponse', value => throwIfNotValid(value, isRegistrationModerationResponseValid, 'moderation response', true))
  @Column(DataType.TEXT)
  declare moderationResponse: string

  @AllowNull(true)
  @Column
  declare password: string

  @AllowNull(false)
  @Column
  declare username: string

  @AllowNull(false)
  @IsEmail
  @Column(DataType.STRING(400))
  declare email: string

  @AllowNull(true)
  @Is('RegistrationEmailVerified', value => throwIfNotValid(value, isUserEmailVerifiedValid, 'email verified boolean', true))
  @Column
  declare emailVerified: boolean

  @AllowNull(true)
  @Is('RegistrationAccountDisplayName', value => throwIfNotValid(value, isUserDisplayNameValid, 'account display name', true))
  @Column
  declare accountDisplayName: string

  @AllowNull(true)
  @Is('ChannelHandle', value => throwIfNotValid(value, isVideoChannelDisplayNameValid, 'channel handle', true))
  @Column
  declare channelHandle: string

  @AllowNull(true)
  @Is('ChannelDisplayName', value => throwIfNotValid(value, isVideoChannelDisplayNameValid, 'channel display name', true))
  @Column
  declare channelDisplayName: string

  @AllowNull(true)
  @Column
  declare processedAt: Date

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => UserModel)
  @Column
  declare userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'SET NULL'
  })
  declare User: Awaited<UserModel>

  @BeforeCreate
  static async cryptPasswordIfNeeded (instance: UserRegistrationModel) {
    instance.password = await cryptPassword(instance.password)
  }

  static load (id: number): Promise<MRegistration> {
    return UserRegistrationModel.findByPk(id)
  }

  static listByEmailCaseInsensitive (email: string): Promise<MRegistration[]> {
    const query = {
      where: where(
        fn('LOWER', col('email')),
        '=',
        email.toLowerCase()
      )
    }

    return UserRegistrationModel.findAll(query)
  }

  static listByEmailCaseInsensitiveOrUsername (emailOrUsername: string): Promise<MRegistration[]> {
    const query = {
      where: {
        [Op.or]: [
          where(
            fn('LOWER', col('email')),
            '=',
            emailOrUsername.toLowerCase()
          ),

          { username: emailOrUsername }
        ]
      }
    }

    return UserRegistrationModel.findAll(query)
  }

  static listByEmailCaseInsensitiveOrHandle (options: {
    email: string
    username: string
    channelHandle?: string
  }): Promise<MRegistration[]> {
    const { email, username, channelHandle } = options

    let or: WhereOptions = [
      where(
        fn('LOWER', col('email')),
        '=',
        email.toLowerCase()
      ),
      { channelHandle: username },
      { username }
    ]

    if (channelHandle) {
      or = or.concat([
        { username: channelHandle },
        { channelHandle }
      ])
    }

    const query = {
      where: {
        [Op.or]: or
      }
    }

    return UserRegistrationModel.findAll(query)
  }

  // ---------------------------------------------------------------------------

  static listForApi (options: {
    start: number
    count: number
    sort: string
    search?: string
  }) {
    const { start, count, sort, search } = options

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

    const query: FindOptions = {
      offset: start,
      limit: count,
      order: getSort(sort),
      where,
      include: [
        {
          model: UserModel.unscoped(),
          required: false
        }
      ]
    }

    return Promise.all([
      UserRegistrationModel.count(query),
      UserRegistrationModel.findAll<MRegistrationFormattable>(query)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  // ---------------------------------------------------------------------------

  static getStats () {
    const query = `SELECT ` +
      `AVG(EXTRACT(EPOCH FROM ("processedAt" - "createdAt") * 1000)) ` +
      `FILTER (WHERE "processedAt" IS NOT NULL AND "createdAt" > CURRENT_DATE - INTERVAL '3 months')` +
      `AS "avgResponseTime", ` +
      // "processedAt" has been introduced in PeerTube 6.1 so also check the abuse state to check processed abuses
      `COUNT(*) FILTER (WHERE "processedAt" IS NOT NULL OR "state" != ${UserRegistrationState.PENDING}) AS "processedRequests", ` +
      `COUNT(*) AS "totalRequests" ` +
      `FROM "userRegistration"`

    return UserRegistrationModel.sequelize.query<any>(query, {
      type: QueryTypes.SELECT,
      raw: true
    }).then(([ row ]) => {
      return {
        totalRegistrationRequests: parseAggregateResult(row.totalRequests),

        totalRegistrationRequestsProcessed: parseAggregateResult(row.processedRequests),

        averageRegistrationRequestResponseTimeMs: row?.avgResponseTime
          ? forceNumber(row.avgResponseTime)
          : null
      }
    })
  }

  // ---------------------------------------------------------------------------

  toFormattedJSON (this: MRegistrationFormattable): UserRegistration {
    return {
      id: this.id,

      state: {
        id: this.state,
        label: USER_REGISTRATION_STATES[this.state]
      },

      registrationReason: this.registrationReason,
      moderationResponse: this.moderationResponse,

      username: this.username,
      email: this.email,
      emailVerified: this.emailVerified,

      accountDisplayName: this.accountDisplayName,

      channelHandle: this.channelHandle,
      channelDisplayName: this.channelDisplayName,

      createdAt: this.createdAt,
      updatedAt: this.updatedAt,

      user: this.User
        ? { id: this.User.id }
        : null
    }
  }
}
