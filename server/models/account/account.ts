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
import { Account, AccountSummary } from '../../../shared/models/actors'
import { isAccountDescriptionValid } from '../../helpers/custom-validators/accounts'
import { sendDeleteActor } from '../../lib/activitypub/send'
import { ActorModel } from '../activitypub/actor'
import { ApplicationModel } from '../application/application'
import { ServerModel } from '../server/server'
import { getSort, throwIfNotValid } from '../utils'
import { VideoChannelModel } from '../video/video-channel'
import { VideoCommentModel } from '../video/video-comment'
import { UserModel } from './user'
import { AvatarModel } from '../avatar/avatar'
import { VideoPlaylistModel } from '../video/video-playlist'
import { CONSTRAINTS_FIELDS, SERVER_ACTOR_NAME, WEBSERVER } from '../../initializers/constants'
import { FindOptions, IncludeOptions, Op, Transaction, WhereOptions } from 'sequelize'
import { AccountBlocklistModel } from './account-blocklist'
import { ServerBlocklistModel } from '../server/server-blocklist'
import { ActorFollowModel } from '../activitypub/actor-follow'
import { MAccountActor, MAccountAP, MAccountDefault, MAccountFormattable, MAccountSummaryFormattable, MAccount } from '../../types/models'
import * as Bluebird from 'bluebird'
import { ModelCache } from '@server/models/model-cache'
import { VideoModel } from '../video/video'

export enum ScopeNames {
  SUMMARY = 'SUMMARY'
}

export type SummaryOptions = {
  actorRequired?: boolean // Default: true
  whereActor?: WhereOptions
  withAccountBlockerIds?: number[]
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
    const whereActor = options.whereActor || undefined

    const serverInclude: IncludeOptions = {
      attributes: [ 'host' ],
      model: ServerModel.unscoped(),
      required: false
    }

    const query: FindOptions = {
      attributes: [ 'id', 'name', 'actorId' ],
      include: [
        {
          attributes: [ 'id', 'preferredUsername', 'url', 'serverId', 'avatarId' ],
          model: ActorModel.unscoped(),
          required: options.actorRequired ?? true,
          where: whereActor,
          include: [
            serverInclude,

            {
              model: AvatarModel.unscoped(),
              required: false
            }
          ]
        }
      ]
    }

    if (options.withAccountBlockerIds) {
      query.include.push({
        attributes: [ 'id' ],
        model: AccountBlocklistModel.unscoped(),
        as: 'BlockedAccounts',
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
export class AccountModel extends Model<AccountModel> {

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
    as: 'BlockedAccounts',
    onDelete: 'CASCADE'
  })
  BlockedAccounts: AccountBlocklistModel[]

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

  static load (id: number, transaction?: Transaction): Bluebird<MAccountDefault> {
    return AccountModel.findByPk(id, { transaction })
  }

  static loadByNameWithHost (nameWithHost: string): Bluebird<MAccountDefault> {
    const [ accountName, host ] = nameWithHost.split('@')

    if (!host || host === WEBSERVER.HOST) return AccountModel.loadLocalByName(accountName)

    return AccountModel.loadByNameAndHost(accountName, host)
  }

  static loadLocalByName (name: string): Bluebird<MAccountDefault> {
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

  static loadByNameAndHost (name: string, host: string): Bluebird<MAccountDefault> {
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

  static loadByUrl (url: string, transaction?: Transaction): Bluebird<MAccountDefault> {
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

    return AccountModel.findAndCountAll(query)
      .then(({ rows, count }) => {
        return {
          data: rows,
          total: count
        }
      })
  }

  static loadAccountIdFromVideo (videoId: number): Bluebird<MAccount> {
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

  static listLocalsForSitemap (sort: string): Bluebird<MAccountActor[]> {
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
    const actor = this.Actor.toFormattedJSON()
    const account = {
      id: this.id,
      displayName: this.getDisplayName(),
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      userId: this.userId ? this.userId : undefined
    }

    return Object.assign(actor, account)
  }

  toFormattedSummaryJSON (this: MAccountSummaryFormattable): AccountSummary {
    const actor = this.Actor.toFormattedSummaryJSON()

    return {
      id: this.id,
      name: actor.name,
      displayName: this.getDisplayName(),
      url: actor.url,
      host: actor.host,
      avatar: actor.avatar
    }
  }

  toActivityPubObject (this: MAccountAP) {
    const obj = this.Actor.toActivityPubObject(this.name)

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

  isBlocked () {
    return this.BlockedAccounts && this.BlockedAccounts.length !== 0
  }
}
