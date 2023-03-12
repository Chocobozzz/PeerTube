import { FindOptions, Includeable, IncludeOptions, Op, Transaction, WhereOptions } from 'sequelize'
import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  DefaultScope,
  ForeignKey,
  HasMany,
  Is,
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { ModelCache } from '@server/models/shared/model-cache'
import { AttributesOnly } from '@shared/typescript-utils'
import { Account, AccountSummary } from '../../../shared/models/actors'
import { isAccountDescriptionValid } from '../../helpers/custom-validators/accounts'
import { CONSTRAINTS_FIELDS, SERVER_ACTOR_NAME, WEBSERVER } from '../../initializers/constants'
import { sendDeleteActor } from '../../lib/activitypub/send/send-delete'
import {
  MAccount,
  MAccountActor,
  MAccountAP,
  MAccountDefault,
  MAccountFormattable,
  MAccountSummaryFormattable,
  MChannelActor
} from '../../types/models'
import { ActorModel } from '../actor/actor'
import { ActorFollowModel } from '../actor/actor-follow'
import { ActorImageModel } from '../actor/actor-image'
import { ApplicationModel } from '../application/application'
import { ServerModel } from '../server/server'
import { ServerBlocklistModel } from '../server/server-blocklist'
import { UserModel } from '../user/user'
import { buildSQLAttributes, getSort, throwIfNotValid } from '../shared'
import { VideoModel } from '../video/video'
import { VideoChannelModel } from '../video/video-channel'
import { VideoCommentModel } from '../video/video-comment'
import { VideoPlaylistModel } from '../video/video-playlist'
import { AccountBlocklistModel } from './account-blocklist'

export enum ScopeNames {
  SUMMARY = 'SUMMARY'
}

export type SummaryOptions = {
  actorRequired?: boolean // Default: true
  whereActor?: WhereOptions
  whereServer?: WhereOptions
  withAccountBlockerIds?: number[]
  forCount?: boolean
}

@DefaultScope(() => ({
  include: [
    {
      model: ActorModel, // Default scope includes avatar and server
      required: true
    }
  ]
}))
@Scopes(() => ({
  [ScopeNames.SUMMARY]: (options: SummaryOptions = {}) => {
    const serverInclude: IncludeOptions = {
      attributes: [ 'host' ],
      model: ServerModel.unscoped(),
      required: !!options.whereServer,
      where: options.whereServer
    }

    const actorInclude: Includeable = {
      attributes: [ 'id', 'preferredUsername', 'url', 'serverId' ],
      model: ActorModel.unscoped(),
      required: options.actorRequired ?? true,
      where: options.whereActor,
      include: [ serverInclude ]
    }

    if (options.forCount !== true) {
      actorInclude.include.push({
        model: ActorImageModel,
        as: 'Avatars',
        required: false
      })
    }

    const queryInclude: Includeable[] = [
      actorInclude
    ]

    const query: FindOptions = {
      attributes: [ 'id', 'name', 'actorId' ]
    }

    if (options.withAccountBlockerIds) {
      queryInclude.push({
        attributes: [ 'id' ],
        model: AccountBlocklistModel.unscoped(),
        as: 'BlockedBy',
        required: false,
        where: {
          accountId: {
            [Op.in]: options.withAccountBlockerIds
          }
        }
      })

      serverInclude.include = [
        {
          attributes: [ 'id' ],
          model: ServerBlocklistModel.unscoped(),
          required: false,
          where: {
            accountId: {
              [Op.in]: options.withAccountBlockerIds
            }
          }
        }
      ]
    }

    query.include = queryInclude

    return query
  }
}))
@Table({
  tableName: 'account',
  indexes: [
    {
      fields: [ 'actorId' ],
      unique: true
    },
    {
      fields: [ 'applicationId' ]
    },
    {
      fields: [ 'userId' ]
    }
  ]
})
export class AccountModel extends Model<Partial<AttributesOnly<AccountModel>>> {

  @AllowNull(false)
  @Column
  name: string

  @AllowNull(true)
  @Default(null)
  @Is('AccountDescription', value => throwIfNotValid(value, isAccountDescriptionValid, 'description', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.USERS.DESCRIPTION.max))
  description: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => ActorModel)
  @Column
  actorId: number

  @BelongsTo(() => ActorModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Actor: ActorModel

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

  @HasMany(() => VideoPlaylistModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade',
    hooks: true
  })
  VideoPlaylists: VideoPlaylistModel[]

  @HasMany(() => VideoCommentModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade',
    hooks: true
  })
  VideoComments: VideoCommentModel[]

  @HasMany(() => AccountBlocklistModel, {
    foreignKey: {
      name: 'targetAccountId',
      allowNull: false
    },
    as: 'BlockedBy',
    onDelete: 'CASCADE'
  })
  BlockedBy: AccountBlocklistModel[]

  @BeforeDestroy
  static async sendDeleteIfOwned (instance: AccountModel, options) {
    if (!instance.Actor) {
      instance.Actor = await instance.$get('Actor', { transaction: options.transaction })
    }

    await ActorFollowModel.removeFollowsOf(instance.Actor.id, options.transaction)

    if (instance.isOwned()) {
      return sendDeleteActor(instance.Actor, options.transaction)
    }

    return undefined
  }

  // ---------------------------------------------------------------------------

  static getSQLAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix
    })
  }

  // ---------------------------------------------------------------------------

  static load (id: number, transaction?: Transaction): Promise<MAccountDefault> {
    return AccountModel.findByPk(id, { transaction })
  }

  static loadByNameWithHost (nameWithHost: string): Promise<MAccountDefault> {
    const [ accountName, host ] = nameWithHost.split('@')

    if (!host || host === WEBSERVER.HOST) return AccountModel.loadLocalByName(accountName)

    return AccountModel.loadByNameAndHost(accountName, host)
  }

  static loadLocalByName (name: string): Promise<MAccountDefault> {
    const fun = () => {
      const query = {
        where: {
          [Op.or]: [
            {
              userId: {
                [Op.ne]: null
              }
            },
            {
              applicationId: {
                [Op.ne]: null
              }
            }
          ]
        },
        include: [
          {
            model: ActorModel,
            required: true,
            where: {
              preferredUsername: name
            }
          }
        ]
      }

      return AccountModel.findOne(query)
    }

    return ModelCache.Instance.doCache({
      cacheType: 'local-account-name',
      key: name,
      fun,
      // The server actor never change, so we can easily cache it
      whitelist: () => name === SERVER_ACTOR_NAME
    })
  }

  static loadByNameAndHost (name: string, host: string): Promise<MAccountDefault> {
    const query = {
      include: [
        {
          model: ActorModel,
          required: true,
          where: {
            preferredUsername: name
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
      ]
    }

    return AccountModel.findOne(query)
  }

  static loadByUrl (url: string, transaction?: Transaction): Promise<MAccountDefault> {
    const query = {
      include: [
        {
          model: ActorModel,
          required: true,
          where: {
            url
          }
        }
      ],
      transaction
    }

    return AccountModel.findOne(query)
  }

  static listForApi (start: number, count: number, sort: string) {
    const query = {
      offset: start,
      limit: count,
      order: getSort(sort)
    }

    return Promise.all([
      AccountModel.count(),
      AccountModel.findAll(query)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static loadAccountIdFromVideo (videoId: number): Promise<MAccount> {
    const query = {
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

    return AccountModel.findOne(query)
  }

  static listLocalsForSitemap (sort: string): Promise<MAccountActor[]> {
    const query = {
      attributes: [ ],
      offset: 0,
      order: getSort(sort),
      include: [
        {
          attributes: [ 'preferredUsername', 'serverId' ],
          model: ActorModel.unscoped(),
          where: {
            serverId: null
          }
        }
      ]
    }

    return AccountModel
      .unscoped()
      .findAll(query)
  }

  getClientUrl () {
    return WEBSERVER.URL + '/accounts/' + this.Actor.getIdentifier()
  }

  toFormattedJSON (this: MAccountFormattable): Account {
    return {
      ...this.Actor.toFormattedJSON(),

      id: this.id,
      displayName: this.getDisplayName(),
      description: this.description,
      updatedAt: this.updatedAt,
      userId: this.userId ?? undefined
    }
  }

  toFormattedSummaryJSON (this: MAccountSummaryFormattable): AccountSummary {
    const actor = this.Actor.toFormattedSummaryJSON()

    return {
      id: this.id,
      displayName: this.getDisplayName(),

      name: actor.name,
      url: actor.url,
      host: actor.host,
      avatars: actor.avatars,

      // TODO: remove, deprecated in 4.2
      avatar: actor.avatar
    }
  }

  async toActivityPubObject (this: MAccountAP) {
    const obj = await this.Actor.toActivityPubObject(this.name)

    return Object.assign(obj, {
      summary: this.description
    })
  }

  isOwned () {
    return this.Actor.isOwned()
  }

  isOutdated () {
    return this.Actor.isOutdated()
  }

  getDisplayName () {
    return this.name
  }

  getLocalUrl (this: MAccountActor | MChannelActor) {
    return WEBSERVER.URL + `/accounts/` + this.Actor.preferredUsername
  }

  isBlocked () {
    return this.BlockedBy && this.BlockedBy.length !== 0
  }
}
