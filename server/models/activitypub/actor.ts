import { values } from 'lodash'
import { extname } from 'path'
import * as Sequelize from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DefaultScope,
  ForeignKey,
  HasMany,
  HasOne,
  Is,
  IsUUID,
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { ActivityPubActorType } from '../../../shared/models/activitypub'
import { Avatar } from '../../../shared/models/avatars/avatar.model'
import { activityPubContextify } from '../../helpers/activitypub'
import {
  isActorFollowersCountValid,
  isActorFollowingCountValid,
  isActorPreferredUsernameValid,
  isActorPrivateKeyValid,
  isActorPublicKeyValid
} from '../../helpers/custom-validators/activitypub/actor'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { ACTIVITY_PUB, ACTIVITY_PUB_ACTOR_TYPES, CONFIG, CONSTRAINTS_FIELDS } from '../../initializers'
import { AccountModel } from '../account/account'
import { AvatarModel } from '../avatar/avatar'
import { ServerModel } from '../server/server'
import { throwIfNotValid } from '../utils'
import { VideoChannelModel } from '../video/video-channel'
import { ActorFollowModel } from './actor-follow'

enum ScopeNames {
  FULL = 'FULL'
}

export const unusedActorAttributesForAPI = [
  'publicKey',
  'privateKey',
  'inboxUrl',
  'outboxUrl',
  'sharedInboxUrl',
  'followersUrl',
  'followingUrl',
  'url',
  'createdAt',
  'updatedAt'
]

@DefaultScope({
  include: [
    {
      model: () => ServerModel,
      required: false
    },
    {
      model: () => AvatarModel,
      required: false
    }
  ]
})
@Scopes({
  [ScopeNames.FULL]: {
    include: [
      {
        model: () => AccountModel.unscoped(),
        required: false
      },
      {
        model: () => VideoChannelModel.unscoped(),
        required: false
      },
      {
        model: () => ServerModel,
        required: false
      },
      {
        model: () => AvatarModel,
        required: false
      }
    ]
  }
})
@Table({
  tableName: 'actor',
  indexes: [
    {
      fields: [ 'url' ],
      unique: true
    },
    {
      fields: [ 'preferredUsername', 'serverId' ],
      unique: true
    },
    {
      fields: [ 'inboxUrl', 'sharedInboxUrl' ]
    },
    {
      fields: [ 'sharedInboxUrl' ]
    },
    {
      fields: [ 'serverId' ]
    },
    {
      fields: [ 'avatarId' ]
    },
    {
      fields: [ 'uuid' ],
      unique: true
    },
    {
      fields: [ 'followersUrl' ]
    }
  ]
})
export class ActorModel extends Model<ActorModel> {

  @AllowNull(false)
  @Column(DataType.ENUM(values(ACTIVITY_PUB_ACTOR_TYPES)))
  type: ActivityPubActorType

  @AllowNull(false)
  @Default(DataType.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  uuid: string

  @AllowNull(false)
  @Is('ActorPreferredUsername', value => throwIfNotValid(value, isActorPreferredUsernameValid, 'actor preferred username'))
  @Column
  preferredUsername: string

  @AllowNull(false)
  @Is('ActorUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.URL.max))
  url: string

  @AllowNull(true)
  @Is('ActorPublicKey', value => throwIfNotValid(value, isActorPublicKeyValid, 'public key'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.PUBLIC_KEY.max))
  publicKey: string

  @AllowNull(true)
  @Is('ActorPublicKey', value => throwIfNotValid(value, isActorPrivateKeyValid, 'private key'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.PRIVATE_KEY.max))
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
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.URL.max))
  inboxUrl: string

  @AllowNull(false)
  @Is('ActorOutboxUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'outbox url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.URL.max))
  outboxUrl: string

  @AllowNull(false)
  @Is('ActorSharedInboxUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'shared inbox url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.URL.max))
  sharedInboxUrl: string

  @AllowNull(false)
  @Is('ActorFollowersUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'followers url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.URL.max))
  followersUrl: string

  @AllowNull(false)
  @Is('ActorFollowingUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'following url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.URL.max))
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
    onDelete: 'set null',
    hooks: true
  })
  Avatar: AvatarModel

  @HasMany(() => ActorFollowModel, {
    foreignKey: {
      name: 'actorId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  ActorFollowing: ActorFollowModel[]

  @HasMany(() => ActorFollowModel, {
    foreignKey: {
      name: 'targetActorId',
      allowNull: false
    },
    as: 'ActorFollowers',
    onDelete: 'cascade'
  })
  ActorFollowers: ActorFollowModel[]

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

  @HasOne(() => AccountModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade',
    hooks: true
  })
  Account: AccountModel

  @HasOne(() => VideoChannelModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade',
    hooks: true
  })
  VideoChannel: VideoChannelModel

  static load (id: number) {
    return ActorModel.unscoped().findById(id)
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

    return ActorModel.scope(ScopeNames.FULL).findAll(query)
  }

  static loadLocalByName (preferredUsername: string, transaction?: Sequelize.Transaction) {
    const query = {
      where: {
        preferredUsername,
        serverId: null
      },
      transaction
    }

    return ActorModel.scope(ScopeNames.FULL).findOne(query)
  }

  static loadByNameAndHost (preferredUsername: string, host: string) {
    const query = {
      where: {
        preferredUsername
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

    return ActorModel.scope(ScopeNames.FULL).findOne(query)
  }

  static loadByUrl (url: string, transaction?: Sequelize.Transaction) {
    const query = {
      where: {
        url
      },
      transaction
    }

    return ActorModel.scope(ScopeNames.FULL).findOne(query)
  }

  static incrementFollows (id: number, column: 'followersCount' | 'followingCount', by: number) {
    // FIXME: typings
    return (ActorModel as any).increment(column, {
      by,
      where: {
        id
      }
    })
  }

  toFormattedJSON () {
    let avatar: Avatar = null
    if (this.Avatar) {
      avatar = this.Avatar.toFormattedJSON()
    }

    return {
      id: this.id,
      url: this.url,
      uuid: this.uuid,
      name: this.preferredUsername,
      host: this.getHost(),
      followingCount: this.followingCount,
      followersCount: this.followersCount,
      avatar,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  toActivityPubObject (name: string, type: 'Account' | 'Application' | 'VideoChannel') {
    let activityPubType
    if (type === 'Account') {
      activityPubType = 'Person' as 'Person'
    } else if (type === 'Application') {
      activityPubType = 'Application' as 'Application'
    } else { // VideoChannel
      activityPubType = 'Group' as 'Group'
    }

    let icon = undefined
    if (this.avatarId) {
      const extension = extname(this.Avatar.filename)
      icon = {
        type: 'Image',
        mediaType: extension === '.png' ? 'image/png' : 'image/jpeg',
        url: this.getAvatarUrl()
      }
    }

    const json = {
      type: activityPubType,
      id: this.url,
      following: this.getFollowingUrl(),
      followers: this.getFollowersUrl(),
      inbox: this.inboxUrl,
      outbox: this.outboxUrl,
      preferredUsername: this.preferredUsername,
      url: this.url,
      name,
      endpoints: {
        sharedInbox: this.sharedInboxUrl
      },
      uuid: this.uuid,
      publicKey: {
        id: this.getPublicKeyUrl(),
        owner: this.url,
        publicKeyPem: this.publicKey
      },
      icon
    }

    return activityPubContextify(json)
  }

  getFollowerSharedInboxUrls (t: Sequelize.Transaction) {
    const query = {
      attributes: [ 'sharedInboxUrl' ],
      include: [
        {
          attribute: [],
          model: ActorFollowModel.unscoped(),
          required: true,
          as: 'ActorFollowing',
          where: {
            state: 'accepted',
            targetActorId: this.id
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

  getWebfingerUrl () {
    return 'acct:' + this.preferredUsername + '@' + this.getHost()
  }

  getIdentifier () {
    return this.Server ? `${this.preferredUsername}@${this.Server.host}` : this.preferredUsername
  }

  getHost () {
    return this.Server ? this.Server.host : CONFIG.WEBSERVER.HOST
  }

  getAvatarUrl () {
    if (!this.avatarId) return undefined

    return CONFIG.WEBSERVER.URL + this.Avatar.getWebserverPath()
  }

  isOutdated () {
    if (this.isOwned()) return false

    const now = Date.now()
    const createdAtTime = this.createdAt.getTime()
    const updatedAtTime = this.updatedAt.getTime()

    return (now - createdAtTime) > ACTIVITY_PUB.ACTOR_REFRESH_INTERVAL &&
      (now - updatedAtTime) > ACTIVITY_PUB.ACTOR_REFRESH_INTERVAL
  }
}
