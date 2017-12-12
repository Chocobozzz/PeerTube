import { join } from 'path'
import * as Sequelize from 'sequelize'
import {
  AfterDestroy,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Is,
  IsUUID,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { Avatar } from '../../../shared/models/avatars/avatar.model'
import { activityPubContextify } from '../../helpers'
import {
  isAccountFollowersCountValid,
  isAccountFollowingCountValid,
  isAccountPrivateKeyValid,
  isAccountPublicKeyValid,
  isActivityPubUrlValid
} from '../../helpers/custom-validators/activitypub'
import { isUserUsernameValid } from '../../helpers/custom-validators/users'
import { AVATARS_DIR, CONFIG, CONSTRAINTS_FIELDS } from '../../initializers'
import { sendDeleteAccount } from '../../lib/activitypub/send'
import { ApplicationModel } from '../application/application'
import { AvatarModel } from '../avatar/avatar'
import { ServerModel } from '../server/server'
import { throwIfNotValid } from '../utils'
import { VideoChannelModel } from '../video/video-channel'
import { AccountFollowModel } from './account-follow'
import { UserModel } from './user'

@Table({
  tableName: 'account',
  indexes: [
    {
      fields: [ 'name' ]
    },
    {
      fields: [ 'serverId' ]
    },
    {
      fields: [ 'userId' ],
      unique: true
    },
    {
      fields: [ 'applicationId' ],
      unique: true
    },
    {
      fields: [ 'name', 'serverId', 'applicationId' ],
      unique: true
    }
  ]
})
export class AccountModel extends Model<Account> {

  @AllowNull(false)
  @Default(DataType.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  uuid: string

  @AllowNull(false)
  @Is('AccountName', value => throwIfNotValid(value, isUserUsernameValid, 'account name'))
  @Column
  name: string

  @AllowNull(false)
  @Is('AccountUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.URL.max))
  url: string

  @AllowNull(true)
  @Is('AccountPublicKey', value => throwIfNotValid(value, isAccountPublicKeyValid, 'public key'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.PUBLIC_KEY.max))
  publicKey: string

  @AllowNull(true)
  @Is('AccountPublicKey', value => throwIfNotValid(value, isAccountPrivateKeyValid, 'private key'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.PRIVATE_KEY.max))
  privateKey: string

  @AllowNull(false)
  @Is('AccountFollowersCount', value => throwIfNotValid(value, isAccountFollowersCountValid, 'followers count'))
  @Column
  followersCount: number

  @AllowNull(false)
  @Is('AccountFollowersCount', value => throwIfNotValid(value, isAccountFollowingCountValid, 'following count'))
  @Column
  followingCount: number

  @AllowNull(false)
  @Is('AccountInboxUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'inbox url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.URL.max))
  inboxUrl: string

  @AllowNull(false)
  @Is('AccountOutboxUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'outbox url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.URL.max))
  outboxUrl: string

  @AllowNull(false)
  @Is('AccountSharedInboxUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'shared inbox url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.URL.max))
  sharedInboxUrl: string

  @AllowNull(false)
  @Is('AccountFollowersUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'followers url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.URL.max))
  followersUrl: string

  @AllowNull(false)
  @Is('AccountFollowingUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'following url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACCOUNTS.URL.max))
  followingUrl: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => AvatarModel)
  @Column
  avatarId: number

  @BelongsTo(() => AvatarModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  Avatar: AvatarModel

  @ForeignKey(() => ServerModel)
  @Column
  serverId: number

  @BelongsTo(() => ServerModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  Server: ServerModel

  @ForeignKey(() => UserModel)
  @Column
  userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  User: UserModel

  @ForeignKey(() => ApplicationModel)
  @Column
  applicationId: number

  @BelongsTo(() => ApplicationModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  Application: ApplicationModel

  @HasMany(() => VideoChannelModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade',
    hooks: true
  })
  VideoChannels: VideoChannelModel[]

  @HasMany(() => AccountFollowModel, {
    foreignKey: {
      name: 'accountId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  AccountFollowing: AccountFollowModel[]

  @HasMany(() => AccountFollowModel, {
    foreignKey: {
      name: 'targetAccountId',
      allowNull: false
    },
    as: 'followers',
    onDelete: 'cascade'
  })
  AccountFollowers: AccountFollowModel[]

  @AfterDestroy
  static sendDeleteIfOwned (instance: AccountModel) {
    if (instance.isOwned()) {
      return sendDeleteAccount(instance, undefined)
    }

    return undefined
  }

  static loadApplication () {
    return AccountModel.findOne({
      include: [
        {
          model: ApplicationModel,
          required: true
        }
      ]
    })
  }

  static load (id: number) {
    return AccountModel.findById(id)
  }

  static loadByUUID (uuid: string) {
    const query = {
      where: {
        uuid
      }
    }

    return AccountModel.findOne(query)
  }

  static loadLocalByName (name: string) {
    const query = {
      where: {
        name,
        [ Sequelize.Op.or ]: [
          {
            userId: {
              [ Sequelize.Op.ne ]: null
            }
          },
          {
            applicationId: {
              [ Sequelize.Op.ne ]: null
            }
          }
        ]
      }
    }

    return AccountModel.findOne(query)
  }

  static loadByNameAndHost (name: string, host: string) {
    const query = {
      where: {
        name
      },
      include: [
        {
          model: ServerModel,
          required: true,
          where: {
            host
          }
        }
      ]
    }

    return AccountModel.findOne(query)
  }

  static loadByUrl (url: string, transaction?: Sequelize.Transaction) {
    const query = {
      where: {
        url
      },
      transaction
    }

    return AccountModel.findOne(query)
  }

  static listByFollowersUrls (followersUrls: string[], transaction?: Sequelize.Transaction) {
    const query = {
      where: {
        followersUrl: {
          [ Sequelize.Op.in ]: followersUrls
        }
      },
      transaction
    }

    return AccountModel.findAll(query)
  }

  toFormattedJSON () {
    let host = CONFIG.WEBSERVER.HOST
    let score: number
    let avatar: Avatar = null

    if (this.Avatar) {
      avatar = {
        path: join(AVATARS_DIR.ACCOUNT, this.Avatar.filename),
        createdAt: this.Avatar.createdAt,
        updatedAt: this.Avatar.updatedAt
      }
    }

    if (this.Server) {
      host = this.Server.host
      score = this.Server.score
    }

    return {
      id: this.id,
      uuid: this.uuid,
      host,
      score,
      name: this.name,
      followingCount: this.followingCount,
      followersCount: this.followersCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      avatar
    }
  }

  toActivityPubObject () {
    const type = this.serverId ? 'Application' as 'Application' : 'Person' as 'Person'

    const json = {
      type,
      id: this.url,
      following: this.getFollowingUrl(),
      followers: this.getFollowersUrl(),
      inbox: this.inboxUrl,
      outbox: this.outboxUrl,
      preferredUsername: this.name,
      url: this.url,
      name: this.name,
      endpoints: {
        sharedInbox: this.sharedInboxUrl
      },
      uuid: this.uuid,
      publicKey: {
        id: this.getPublicKeyUrl(),
        owner: this.url,
        publicKeyPem: this.publicKey
      }
    }

    return activityPubContextify(json)
  }

  isOwned () {
    return this.serverId === null
  }

  getFollowerSharedInboxUrls (t: Sequelize.Transaction) {
    const query = {
      attributes: [ 'sharedInboxUrl' ],
      include: [
        {
          model: AccountFollowModel,
          required: true,
          as: 'followers',
          where: {
            targetAccountId: this.id
          }
        }
      ],
      transaction: t
    }

    return AccountModel.findAll(query)
      .then(accounts => accounts.map(a => a.sharedInboxUrl))
  }

  getFollowingUrl () {
    return this.url + '/following'
  }

  getFollowersUrl () {
    return this.url + '/followers'
  }

  getPublicKeyUrl () {
    return this.url + '#main-key'
  }
}
