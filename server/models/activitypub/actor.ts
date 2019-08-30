import { values } from 'lodash'
import { extname } from 'path'
import * as Sequelize from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  DefaultScope,
  ForeignKey,
  HasMany,
  HasOne,
  Is,
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
import { ACTIVITY_PUB, ACTIVITY_PUB_ACTOR_TYPES, CONSTRAINTS_FIELDS, WEBSERVER } from '../../initializers/constants'
import { AccountModel } from '../account/account'
import { AvatarModel } from '../avatar/avatar'
import { ServerModel } from '../server/server'
import { isOutdated, throwIfNotValid } from '../utils'
import { VideoChannelModel } from '../video/video-channel'
import { ActorFollowModel } from './actor-follow'
import { VideoModel } from '../video/video'
import {
  MActor,
  MActorAccountChannelId,
  MActorAP,
  MActorFormattable,
  MActorFull,
  MActorHost,
  MActorServer,
  MActorSummaryFormattable
} from '../../typings/models'
import * as Bluebird from 'bluebird'

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

@DefaultScope(() => ({
  include: [
    {
      model: ServerModel,
      required: false
    },
    {
      model: AvatarModel,
      required: false
    }
  ]
}))
@Scopes(() => ({
  [ScopeNames.FULL]: {
    include: [
      {
        model: AccountModel.unscoped(),
        required: false
      },
      {
        model: VideoChannelModel.unscoped(),
        required: false,
        include: [
          {
            model: AccountModel,
            required: true
          }
        ]
      },
      {
        model: ServerModel,
        required: false
      },
      {
        model: AvatarModel,
        required: false
      }
    ]
  }
}))
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
      fields: [ 'followersUrl' ]
    }
  ]
})
export class ActorModel extends Model<ActorModel> {

  @AllowNull(false)
  @Column(DataType.ENUM(...values(ACTIVITY_PUB_ACTOR_TYPES)))
  type: ActivityPubActorType

  @AllowNull(false)
  @Is('ActorPreferredUsername', value => throwIfNotValid(value, isActorPreferredUsernameValid, 'actor preferred username'))
  @Column
  preferredUsername: string

  @AllowNull(false)
  @Is('ActorUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.URL.max))
  url: string

  @AllowNull(true)
  @Is('ActorPublicKey', value => throwIfNotValid(value, isActorPublicKeyValid, 'public key', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.PUBLIC_KEY.max))
  publicKey: string

  @AllowNull(true)
  @Is('ActorPublicKey', value => throwIfNotValid(value, isActorPrivateKeyValid, 'private key', true))
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

  @AllowNull(true)
  @Is('ActorOutboxUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'outbox url', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.URL.max))
  outboxUrl: string

  @AllowNull(false)
  @Is('ActorSharedInboxUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'shared inbox url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.URL.max))
  sharedInboxUrl: string

  @AllowNull(true)
  @Is('ActorFollowersUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'followers url', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.ACTORS.URL.max))
  followersUrl: string

  @AllowNull(true)
  @Is('ActorFollowingUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'following url', true))
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
    as: 'ActorFollowings',
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

  static load (id: number): Bluebird<MActor> {
    return ActorModel.unscoped().findByPk(id)
  }

  static loadFull (id: number): Bluebird<MActorFull> {
    return ActorModel.scope(ScopeNames.FULL).findByPk(id)
  }

  static loadFromAccountByVideoId (videoId: number, transaction: Sequelize.Transaction): Bluebird<MActor> {
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
                  where: {
                    id: videoId
                  }
                }
              ]
            }
          ]
        }
      ],
      transaction
    }

    return ActorModel.unscoped().findOne(query)
  }

  static isActorUrlExist (url: string) {
    const query = {
      raw: true,
      where: {
        url
      }
    }

    return ActorModel.unscoped().findOne(query)
      .then(a => !!a)
  }

  static listByFollowersUrls (followersUrls: string[], transaction?: Sequelize.Transaction): Bluebird<MActorFull[]> {
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

  static loadLocalByName (preferredUsername: string, transaction?: Sequelize.Transaction): Bluebird<MActorFull> {
    const query = {
      where: {
        preferredUsername,
        serverId: null
      },
      transaction
    }

    return ActorModel.scope(ScopeNames.FULL).findOne(query)
  }

  static loadByNameAndHost (preferredUsername: string, host: string): Bluebird<MActorFull> {
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

  static loadByUrl (url: string, transaction?: Sequelize.Transaction): Bluebird<MActorAccountChannelId> {
    const query = {
      where: {
        url
      },
      transaction,
      include: [
        {
          attributes: [ 'id' ],
          model: AccountModel.unscoped(),
          required: false
        },
        {
          attributes: [ 'id' ],
          model: VideoChannelModel.unscoped(),
          required: false
        }
      ]
    }

    return ActorModel.unscoped().findOne(query)
  }

  static loadByUrlAndPopulateAccountAndChannel (url: string, transaction?: Sequelize.Transaction): Bluebird<MActorFull> {
    const query = {
      where: {
        url
      },
      transaction
    }

    return ActorModel.scope(ScopeNames.FULL).findOne(query)
  }

  static incrementFollows (id: number, column: 'followersCount' | 'followingCount', by: number) {
    return ActorModel.increment(column, {
      by,
      where: {
        id
      }
    })
  }

  toFormattedSummaryJSON (this: MActorSummaryFormattable) {
    let avatar: Avatar = null
    if (this.Avatar) {
      avatar = this.Avatar.toFormattedJSON()
    }

    return {
      url: this.url,
      name: this.preferredUsername,
      host: this.getHost(),
      avatar
    }
  }

  toFormattedJSON (this: MActorFormattable) {
    const base = this.toFormattedSummaryJSON()

    return Object.assign(base, {
      id: this.id,
      hostRedundancyAllowed: this.getRedundancyAllowed(),
      followingCount: this.followingCount,
      followersCount: this.followersCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    })
  }

  toActivityPubObject (this: MActorAP, name: string) {
    let activityPubType

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
      type: this.type,
      id: this.url,
      following: this.getFollowingUrl(),
      followers: this.getFollowersUrl(),
      playlists: this.getPlaylistsUrl(),
      inbox: this.inboxUrl,
      outbox: this.outboxUrl,
      preferredUsername: this.preferredUsername,
      url: this.url,
      name,
      endpoints: {
        sharedInbox: this.sharedInboxUrl
      },
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

  getPlaylistsUrl () {
    return this.url + '/playlists'
  }

  getPublicKeyUrl () {
    return this.url + '#main-key'
  }

  isOwned () {
    return this.serverId === null
  }

  getWebfingerUrl (this: MActorServer) {
    return 'acct:' + this.preferredUsername + '@' + this.getHost()
  }

  getIdentifier () {
    return this.Server ? `${this.preferredUsername}@${this.Server.host}` : this.preferredUsername
  }

  getHost (this: MActorHost) {
    return this.Server ? this.Server.host : WEBSERVER.HOST
  }

  getRedundancyAllowed () {
    return this.Server ? this.Server.redundancyAllowed : false
  }

  getAvatarUrl () {
    if (!this.avatarId) return undefined

    return WEBSERVER.URL + this.Avatar.getStaticPath()
  }

  isOutdated () {
    if (this.isOwned()) return false

    return isOutdated(this, ACTIVITY_PUB.ACTOR_REFRESH_INTERVAL)
  }
}
