import { forceNumber, maxBy } from '@peertube/peertube-core-utils'
import { ActivityIconObject, ActorImageType, ActorImageType_Type, type ActivityPubActorType } from '@peertube/peertube-models'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { activityPubContextify } from '@server/helpers/activity-pub-utils.js'
import { getContextFilter } from '@server/lib/activitypub/context.js'
import { ModelCache } from '@server/models/shared/model-cache.js'
import { Op, QueryTypes, Transaction, col, fn, literal, where } from 'sequelize'
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
  Is, Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { Where } from 'sequelize/types/utils'
import {
  isActorFollowersCountValid,
  isActorFollowingCountValid,
  isActorPreferredUsernameValid,
  isActorPrivateKeyValid,
  isActorPublicKeyValid
} from '../../helpers/custom-validators/activitypub/actor.js'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc.js'
import {
  ACTIVITY_PUB,
  ACTIVITY_PUB_ACTOR_TYPES,
  CONSTRAINTS_FIELDS, SERVER_ACTOR_NAME,
  WEBSERVER
} from '../../initializers/constants.js'
import {
  MActor,
  MActorAPAccount,
  MActorAPChannel,
  MActorAccountChannelId,
  MActorFollowersUrl,
  MActorFormattable,
  MActorFull,
  MActorHost,
  MActorHostOnly,
  MActorId,
  MActorSummaryFormattable,
  MActorUrl,
  MActorWithInboxes
} from '../../types/models/index.js'
import { AccountModel } from '../account/account.js'
import { getServerActor } from '../application/application.js'
import { ServerModel } from '../server/server.js'
import { SequelizeModel, buildSQLAttributes, isOutdated, throwIfNotValid } from '../shared/index.js'
import { VideoChannelModel } from '../video/video-channel.js'
import { VideoModel } from '../video/video.js'
import { ActorFollowModel } from './actor-follow.js'
import { ActorImageModel } from './actor-image.js'

enum ScopeNames {
  FULL = 'FULL'
}

export const unusedActorAttributesForAPI: (keyof AttributesOnly<ActorModel>)[] = [
  'publicKey',
  'privateKey',
  'inboxUrl',
  'outboxUrl',
  'sharedInboxUrl',
  'followersUrl',
  'followingUrl'
]

@DefaultScope(() => ({
  include: [
    {
      model: ServerModel,
      required: false
    },
    {
      model: ActorImageModel,
      as: 'Avatars',
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
        model: ActorImageModel,
        as: 'Avatars',
        required: false
      },
      {
        model: ActorImageModel,
        as: 'Banners',
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
      fields: [ fn('lower', col('preferredUsername')), 'serverId' ],
      name: 'actor_preferred_username_lower_server_id',
      unique: true,
      where: {
        serverId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ fn('lower', col('preferredUsername')) ],
      name: 'actor_preferred_username_lower',
      unique: true,
      where: {
        serverId: null
      }
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
      fields: [ 'followersUrl' ]
    }
  ]
})
export class ActorModel extends SequelizeModel<ActorModel> {

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(ACTIVITY_PUB_ACTOR_TYPES)))
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

  @AllowNull(true)
  @Is('ActorSharedInboxUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'shared inbox url', true))
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

  @AllowNull(true)
  @Column
  remoteCreatedAt: Date

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @HasMany(() => ActorImageModel, {
    as: 'Avatars',
    onDelete: 'cascade',
    hooks: true,
    foreignKey: {
      allowNull: false
    },
    scope: {
      type: ActorImageType.AVATAR
    }
  })
  Avatars: Awaited<ActorImageModel>[]

  @HasMany(() => ActorImageModel, {
    as: 'Banners',
    onDelete: 'cascade',
    hooks: true,
    foreignKey: {
      allowNull: false
    },
    scope: {
      type: ActorImageType.BANNER
    }
  })
  Banners: Awaited<ActorImageModel>[]

  @HasMany(() => ActorFollowModel, {
    foreignKey: {
      name: 'actorId',
      allowNull: false
    },
    as: 'ActorFollowings',
    onDelete: 'cascade'
  })
  ActorFollowing: Awaited<ActorFollowModel>[]

  @HasMany(() => ActorFollowModel, {
    foreignKey: {
      name: 'targetActorId',
      allowNull: false
    },
    as: 'ActorFollowers',
    onDelete: 'cascade'
  })
  ActorFollowers: Awaited<ActorFollowModel>[]

  @ForeignKey(() => ServerModel)
  @Column
  serverId: number

  @BelongsTo(() => ServerModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  Server: Awaited<ServerModel>

  @HasOne(() => AccountModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade',
    hooks: true
  })
  Account: Awaited<AccountModel>

  @HasOne(() => VideoChannelModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade',
    hooks: true
  })
  VideoChannel: Awaited<VideoChannelModel>

  // ---------------------------------------------------------------------------

  static getSQLAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix
    })
  }

  static getSQLAPIAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix,
      excludeAttributes: unusedActorAttributesForAPI
    })
  }

  // ---------------------------------------------------------------------------

  // FIXME: have to specify the result type to not break peertube typings generation
  static wherePreferredUsername (preferredUsername: string, colName = 'preferredUsername'): Where {
    return where(fn('lower', col(colName)), preferredUsername.toLowerCase())
  }

  // ---------------------------------------------------------------------------

  static async load (id: number): Promise<MActor> {
    const actorServer = await getServerActor()
    if (id === actorServer.id) return actorServer

    return ActorModel.unscoped().findByPk(id)
  }

  static loadFull (id: number): Promise<MActorFull> {
    return ActorModel.scope(ScopeNames.FULL).findByPk(id)
  }

  static loadAccountActorFollowerUrlByVideoId (videoId: number, transaction: Transaction) {
    const query = `SELECT "actor"."id" AS "id", "actor"."followersUrl" AS "followersUrl" ` +
                  `FROM "actor" ` +
                  `INNER JOIN "account" ON "actor"."id" = "account"."actorId" ` +
                  `INNER JOIN "videoChannel" ON "videoChannel"."accountId" = "account"."id" ` +
                  `INNER JOIN "video" ON "video"."channelId" = "videoChannel"."id" AND "video"."id" = :videoId`

    const options = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      replacements: { videoId },
      plain: true as true,
      transaction
    }

    return ActorModel.sequelize.query<MActorId & MActorFollowersUrl>(query, options)
  }

  static listByFollowersUrls (followersUrls: string[], transaction?: Transaction): Promise<MActorFull[]> {
    const query = {
      where: {
        followersUrl: {
          [Op.in]: followersUrls
        }
      },
      transaction
    }

    return ActorModel.scope(ScopeNames.FULL).findAll(query)
  }

  static loadLocalByName (preferredUsername: string, transaction?: Transaction): Promise<MActorFull> {
    const fun = () => {
      const query = {
        where: {
          [Op.and]: [
            this.wherePreferredUsername(preferredUsername, '"ActorModel"."preferredUsername"'),
            {
              serverId: null
            }
          ]
        },
        transaction
      }

      return ActorModel.scope(ScopeNames.FULL).findOne(query)
    }

    return ModelCache.Instance.doCache({
      cacheType: 'local-actor-name',
      key: preferredUsername,
      // The server actor never change, so we can easily cache it
      whitelist: () => preferredUsername === SERVER_ACTOR_NAME,
      fun
    })
  }

  static loadLocalUrlByName (preferredUsername: string, transaction?: Transaction): Promise<MActorUrl> {
    const fun = () => {
      const query = {
        attributes: [ 'url' ],
        where: {
          [Op.and]: [
            this.wherePreferredUsername(preferredUsername),
            {
              serverId: null
            }
          ]
        },
        transaction
      }

      return ActorModel.unscoped().findOne(query)
    }

    return ModelCache.Instance.doCache({
      cacheType: 'local-actor-url',
      key: preferredUsername,
      // The server actor never change, so we can easily cache it
      whitelist: () => preferredUsername === SERVER_ACTOR_NAME,
      fun
    })
  }

  static loadByNameAndHost (preferredUsername: string, host: string): Promise<MActorFull> {
    const query = {
      where: this.wherePreferredUsername(preferredUsername, '"ActorModel"."preferredUsername"'),
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

  static loadByUrl (url: string, transaction?: Transaction): Promise<MActorAccountChannelId> {
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

  static loadByUrlAndPopulateAccountAndChannel (url: string, transaction?: Transaction): Promise<MActorFull> {
    const query = {
      where: {
        url
      },
      transaction
    }

    return ActorModel.scope(ScopeNames.FULL).findOne(query)
  }

  static rebuildFollowsCount (ofId: number, type: 'followers' | 'following', transaction?: Transaction) {
    const sanitizedOfId = forceNumber(ofId)
    const where = { id: sanitizedOfId }

    let columnToUpdate: string
    let columnOfCount: string

    if (type === 'followers') {
      columnToUpdate = 'followersCount'
      columnOfCount = 'targetActorId'
    } else {
      columnToUpdate = 'followingCount'
      columnOfCount = 'actorId'
    }

    return ActorModel.update({
      [columnToUpdate]: literal(`(SELECT COUNT(*) FROM "actorFollow" WHERE "${columnOfCount}" = ${sanitizedOfId} AND "state" = 'accepted')`)
    }, { where, transaction })
  }

  static loadAccountActorByVideoId (videoId: number, transaction: Transaction): Promise<MActor> {
    const query = {
      include: [
        {
          attributes: [ 'id' ],
          model: AccountModel.unscoped(),
          required: true,
          include: [
            {
              attributes: [ 'id', 'accountId' ],
              model: VideoChannelModel.unscoped(),
              required: true,
              include: [
                {
                  attributes: [ 'id', 'channelId' ],
                  model: VideoModel.unscoped(),
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

  getSharedInbox (this: MActorWithInboxes) {
    return this.sharedInboxUrl || this.inboxUrl
  }

  toFormattedSummaryJSON (this: MActorSummaryFormattable) {
    return {
      url: this.url,
      name: this.preferredUsername,
      host: this.getHost(),
      avatars: (this.Avatars || []).map(a => a.toFormattedJSON())
    }
  }

  toFormattedJSON (this: MActorFormattable, includeBanner = true) {
    return {
      ...this.toFormattedSummaryJSON(),

      id: this.id,
      hostRedundancyAllowed: this.getRedundancyAllowed(),
      followingCount: this.followingCount,
      followersCount: this.followersCount,
      createdAt: this.getCreatedAt(),

      banners: includeBanner
        ? (this.Banners || []).map(b => b.toFormattedJSON())
        : undefined
    }
  }

  toActivityPubObject (this: MActorAPChannel | MActorAPAccount, name: string) {
    let icon: ActivityIconObject[] // Avatars
    let image: ActivityIconObject[] // Banners

    if (this.hasImage(ActorImageType.AVATAR)) {
      icon = this.Avatars.map(a => a.toActivityPubObject())
    }

    if (this.hasImage(ActorImageType.BANNER)) {
      image = (this as MActorAPChannel).Banners.map(b => b.toActivityPubObject())
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
      published: this.getCreatedAt().toISOString(),

      icon,

      image
    }

    return activityPubContextify(json, 'Actor', getContextFilter())
  }

  getFollowerSharedInboxUrls (t: Transaction) {
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

  getWebfingerUrl (this: MActorHost) {
    return 'acct:' + this.preferredUsername + '@' + this.getHost()
  }

  getIdentifier (this: MActorHost) {
    return this.Server ? `${this.preferredUsername}@${this.Server.host}` : this.preferredUsername
  }

  getFullIdentifier (this: MActorHost) {
    return `${this.preferredUsername}@${this.getHost()}`
  }

  getHost (this: MActorHostOnly) {
    return this.Server ? this.Server.host : WEBSERVER.HOST
  }

  getRedundancyAllowed () {
    return this.Server ? this.Server.redundancyAllowed : false
  }

  hasImage (type: ActorImageType_Type) {
    const images = type === ActorImageType.AVATAR
      ? this.Avatars
      : this.Banners

    return Array.isArray(images) && images.length !== 0
  }

  getMaxQualityImage (type: ActorImageType_Type) {
    if (!this.hasImage(type)) return undefined

    const images = type === ActorImageType.AVATAR
      ? this.Avatars
      : this.Banners

    return maxBy(images, 'height')
  }

  isOutdated () {
    if (this.isOwned()) return false

    return isOutdated(this, ACTIVITY_PUB.ACTOR_REFRESH_INTERVAL)
  }

  getCreatedAt (this: MActorAPChannel | MActorAPAccount | MActorFormattable) {
    return this.remoteCreatedAt || this.createdAt
  }
}
