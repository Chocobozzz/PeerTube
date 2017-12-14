import { join } from 'path'
import * as Sequelize from 'sequelize'
import {
  AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, HasMany, Is, IsUUID, Model, Table,
  UpdatedAt
} from 'sequelize-typescript'
import { Avatar } from '../../../shared/models/avatars/avatar.model'
import { activityPubContextify } from '../../helpers'
import {
  isActivityPubUrlValid,
  isActorFollowersCountValid,
  isActorFollowingCountValid, isActorPreferredUsernameValid,
  isActorPrivateKeyValid,
  isActorPublicKeyValid
} from '../../helpers/custom-validators/activitypub'
import { isUserUsernameValid } from '../../helpers/custom-validators/users'
import { AVATARS_DIR, CONFIG, CONSTRAINTS_FIELDS } from '../../initializers'
import { AccountFollowModel } from '../account/account-follow'
import { AvatarModel } from '../avatar/avatar'
import { ServerModel } from '../server/server'
import { throwIfNotValid } from '../utils'

@Table({
  tableName: 'actor'
})
export class ActorModel extends Model<ActorModel> {

  @AllowNull(false)
  @Default(DataType.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  uuid: string

  @AllowNull(false)
  @Is('ActorName', value => throwIfNotValid(value, isActorPreferredUsernameValid, 'actor name'))
  @Column
  name: string

  @AllowNull(false)
  @Is('ActorUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTOR.URL.max))
  url: string

  @AllowNull(true)
  @Is('ActorPublicKey', value => throwIfNotValid(value, isActorPublicKeyValid, 'public key'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTOR.PUBLIC_KEY.max))
  publicKey: string

  @AllowNull(true)
  @Is('ActorPublicKey', value => throwIfNotValid(value, isActorPrivateKeyValid, 'private key'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTOR.PRIVATE_KEY.max))
  privateKey: string

  @AllowNull(false)
  @Is('ActorFollowersCount', value => throwIfNotValid(value, isActorFollowersCountValid, 'followers count'))
  @Column
  followersCount: number

  @AllowNull(false)
  @Is('ActorFollowersCount', value => throwIfNotValid(value, isActorFollowingCountValid, 'following count'))
  @Column
  followingCount: number

  @AllowNull(false)
  @Is('ActorInboxUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'inbox url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTOR.URL.max))
  inboxUrl: string

  @AllowNull(false)
  @Is('ActorOutboxUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'outbox url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTOR.URL.max))
  outboxUrl: string

  @AllowNull(false)
  @Is('ActorSharedInboxUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'shared inbox url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTOR.URL.max))
  sharedInboxUrl: string

  @AllowNull(false)
  @Is('ActorFollowersUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'followers url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTOR.URL.max))
  followersUrl: string

  @AllowNull(false)
  @Is('ActorFollowingUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'following url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTOR.URL.max))
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

  static listByFollowersUrls (followersUrls: string[], transaction?: Sequelize.Transaction) {
    const query = {
      where: {
        followersUrl: {
          [ Sequelize.Op.in ]: followersUrls
        }
      },
      transaction
    }

    return ActorModel.findAll(query)
  }

  toFormattedJSON () {
    let avatar: Avatar = null
    if (this.Avatar) {
      avatar = {
        path: join(AVATARS_DIR.ACCOUNT, this.Avatar.filename),
        createdAt: this.Avatar.createdAt,
        updatedAt: this.Avatar.updatedAt
      }
    }

    let host = CONFIG.WEBSERVER.HOST
    let score: number
    if (this.Server) {
      host = this.Server.host
      score = this.Server.score
    }

    return {
      id: this.id,
      host,
      score,
      followingCount: this.followingCount,
      followersCount: this.followersCount,
      avatar
    }
  }

  toActivityPubObject (name: string, uuid: string, type: 'Account' | 'VideoChannel') {
    let activityPubType
    if (type === 'Account') {
      activityPubType = this.serverId ? 'Application' as 'Application' : 'Person' as 'Person'
    } else { // VideoChannel
      activityPubType = 'Group'
    }

    const json = {
      type,
      id: this.url,
      following: this.getFollowingUrl(),
      followers: this.getFollowersUrl(),
      inbox: this.inboxUrl,
      outbox: this.outboxUrl,
      preferredUsername: name,
      url: this.url,
      name,
      endpoints: {
        sharedInbox: this.sharedInboxUrl
      },
      uuid,
      publicKey: {
        id: this.getPublicKeyUrl(),
        owner: this.url,
        publicKeyPem: this.publicKey
      }
    }

    return activityPubContextify(json)
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

    return ActorModel.findAll(query)
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

  isOwned () {
    return this.serverId === null
  }
}
