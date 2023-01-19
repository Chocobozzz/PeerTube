import { FindOptions, Op, WhereOptions } from 'sequelize'
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
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import {
  isRegistrationModerationResponseValid,
  isRegistrationReasonValid,
  isRegistrationStateValid
} from '@server/helpers/custom-validators/user-registration'
import { isVideoChannelDisplayNameValid } from '@server/helpers/custom-validators/video-channels'
import { cryptPassword } from '@server/helpers/peertube-crypto'
import { USER_REGISTRATION_STATES } from '@server/initializers/constants'
import { MRegistration, MRegistrationFormattable } from '@server/types/models'
import { UserRegistration, UserRegistrationState } from '@shared/models'
import { AttributesOnly } from '@shared/typescript-utils'
import { isUserDisplayNameValid, isUserEmailVerifiedValid, isUserPasswordValid } from '../../helpers/custom-validators/users'
import { getSort, throwIfNotValid } from '../shared'
import { UserModel } from './user'

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
export class UserRegistrationModel extends Model<Partial<AttributesOnly<UserRegistrationModel>>> {

  @AllowNull(false)
  @Is('RegistrationState', value => throwIfNotValid(value, isRegistrationStateValid, 'state'))
  @Column
  state: UserRegistrationState

  @AllowNull(false)
  @Is('RegistrationReason', value => throwIfNotValid(value, isRegistrationReasonValid, 'registration reason'))
  @Column(DataType.TEXT)
  registrationReason: string

  @AllowNull(true)
  @Is('RegistrationModerationResponse', value => throwIfNotValid(value, isRegistrationModerationResponseValid, 'moderation response', true))
  @Column(DataType.TEXT)
  moderationResponse: string

  @AllowNull(true)
  @Is('RegistrationPassword', value => throwIfNotValid(value, isUserPasswordValid, 'registration password', true))
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
  @Is('RegistrationEmailVerified', value => throwIfNotValid(value, isUserEmailVerifiedValid, 'email verified boolean', true))
  @Column
  emailVerified: boolean

  @AllowNull(true)
  @Is('RegistrationAccountDisplayName', value => throwIfNotValid(value, isUserDisplayNameValid, 'account display name', true))
  @Column
  accountDisplayName: string

  @AllowNull(true)
  @Is('ChannelHandle', value => throwIfNotValid(value, isVideoChannelDisplayNameValid, 'channel handle', true))
  @Column
  channelHandle: string

  @AllowNull(true)
  @Is('ChannelDisplayName', value => throwIfNotValid(value, isVideoChannelDisplayNameValid, 'channel display name', true))
  @Column
  channelDisplayName: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => UserModel)
  @Column
  userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'SET NULL'
  })
  User: UserModel

  @BeforeCreate
  static async cryptPasswordIfNeeded (instance: UserRegistrationModel) {
    instance.password = await cryptPassword(instance.password)
  }

  static load (id: number): Promise<MRegistration> {
    return UserRegistrationModel.findByPk(id)
  }

  static loadByEmail (email: string): Promise<MRegistration> {
    const query = {
      where: { email }
    }

    return UserRegistrationModel.findOne(query)
  }

  static loadByEmailOrUsername (emailOrUsername: string): Promise<MRegistration> {
    const query = {
      where: {
        [Op.or]: [
          { email: emailOrUsername },
          { username: emailOrUsername }
        ]
      }
    }

    return UserRegistrationModel.findOne(query)
  }

  static loadByEmailOrHandle (options: {
    email: string
    username: string
    channelHandle?: string
  }): Promise<MRegistration> {
    const { email, username, channelHandle } = options

    let or: WhereOptions = [
      { email },
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

    return UserRegistrationModel.findOne(query)
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
