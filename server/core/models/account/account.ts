import { Account, AccountSummary, ActivityPubActor, ActivityUrlObject, VideoPrivacy } from '@peertube/peertube-models'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { ModelCache } from '@server/models/shared/model-cache.js'
import { FindOptions, IncludeOptions, Includeable, Op, Transaction, WhereOptions, literal } from 'sequelize'
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
  HasOne,
  Is,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isAccountDescriptionValid } from '../../helpers/custom-validators/accounts.js'
import { CONSTRAINTS_FIELDS, SERVER_ACTOR_NAME, WEBSERVER } from '../../initializers/constants.js'
import { sendDeleteActor } from '../../lib/activitypub/send/send-delete.js'
import {
  MAccount,
  MAccountAP,
  MAccountDefault,
  MAccountFormattable,
  MAccountHost,
  MAccountIdHost,
  MAccountSummaryFormattable,
  MChannelIdHost
} from '../../types/models/index.js'
import { ActorImageModel } from '../actor/actor-image.js'
import { ActorModel, actorSummaryAttributes } from '../actor/actor.js'
import { ApplicationModel } from '../application/application.js'
import { AccountAutomaticTagPolicyModel } from '../automatic-tag/account-automatic-tag-policy.js'
import { CommentAutomaticTagModel } from '../automatic-tag/comment-automatic-tag.js'
import { VideoAutomaticTagModel } from '../automatic-tag/video-automatic-tag.js'
import { ServerBlocklistModel } from '../server/server-blocklist.js'
import { ServerModel, serverSummaryAttributes } from '../server/server.js'
import { SequelizeModel, buildSQLAttributes, getSort, throwIfNotValid } from '../shared/index.js'
import { UserModel } from '../user/user.js'
import { VideoChannelCollaboratorModel } from '../video/video-channel-collaborator.js'
import { VideoChannelModel } from '../video/video-channel.js'
import { VideoCommentModel } from '../video/video-comment.js'
import { VideoPlaylistModel } from '../video/video-playlist.js'
import { VideoModel } from '../video/video.js'
import { AccountBlocklistModel } from './account-blocklist.js'

export enum ScopeNames {
  SUMMARY = 'SUMMARY'
}

const accountSummaryAttributes = [ 'id', 'name' ] as const satisfies (keyof AttributesOnly<AccountModel>)[]

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
      attributes: serverSummaryAttributes,
      model: ServerModel.unscoped(),
      required: !!options.whereServer,
      where: options.whereServer
    }

    const actorInclude: Includeable = {
      attributes: actorSummaryAttributes,
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
      attributes: accountSummaryAttributes
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
      fields: [ 'applicationId' ]
    },
    {
      fields: [ 'userId' ]
    }
  ]
})
export class AccountModel extends SequelizeModel<AccountModel> {
  @AllowNull(false)
  @Column
  declare name: string

  @AllowNull(true)
  @Default(null)
  @Is('AccountDescription', value => throwIfNotValid(value, isAccountDescriptionValid, 'description', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.USERS.DESCRIPTION.max))
  declare description: string

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
    onDelete: 'cascade'
  })
  declare User: Awaited<UserModel>

  @ForeignKey(() => ApplicationModel)
  @Column
  declare applicationId: number

  @BelongsTo(() => ApplicationModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare Application: Awaited<ApplicationModel>

  @HasMany(() => VideoChannelModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade',
    hooks: true
  })
  declare VideoChannels: Awaited<VideoChannelModel>[]

  @HasMany(() => VideoPlaylistModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade',
    hooks: true
  })
  declare VideoPlaylists: Awaited<VideoPlaylistModel>[]

  @HasMany(() => VideoCommentModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade',
    hooks: true
  })
  declare VideoComments: Awaited<VideoCommentModel>[]

  @HasMany(() => AccountBlocklistModel, {
    foreignKey: {
      name: 'targetAccountId',
      allowNull: false
    },
    as: 'BlockedBy',
    onDelete: 'CASCADE'
  })
  declare BlockedBy: Awaited<AccountBlocklistModel>[]

  @HasMany(() => AccountAutomaticTagPolicyModel, {
    foreignKey: {
      name: 'accountId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare AccountAutomaticTagPolicies: Awaited<AccountAutomaticTagPolicyModel>[]

  @HasMany(() => CommentAutomaticTagModel, {
    foreignKey: 'accountId',
    onDelete: 'CASCADE'
  })
  declare CommentAutomaticTags: Awaited<CommentAutomaticTagModel>[]

  @HasMany(() => VideoAutomaticTagModel, {
    foreignKey: 'accountId',
    onDelete: 'CASCADE'
  })
  declare VideoAutomaticTags: Awaited<VideoAutomaticTagModel>[]

  @HasMany(() => VideoChannelCollaboratorModel, {
    foreignKey: 'accountId',
    onDelete: 'CASCADE'
  })
  declare VideoChannelCollaborators: Awaited<VideoChannelCollaboratorModel>[]

  @HasOne(() => ActorModel, {
    foreignKey: {
      allowNull: true
    },
    hooks: true,
    onDelete: 'cascade'
  })
  declare Actor: Awaited<ActorModel>

  @BeforeDestroy
  static async sendDeleteIfOwned (instance: AccountModel, options) {
    if (!instance.Actor) {
      instance.Actor = await instance.$get('Actor', { transaction: options.transaction })
    }

    if (instance.isLocal()) {
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

  static getSQLSummaryAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix,
      includeAttributes: accountSummaryAttributes
    })
  }

  // ---------------------------------------------------------------------------

  static load (id: number, transaction?: Transaction): Promise<MAccountDefault> {
    return AccountModel.findByPk(id, { transaction })
  }

  static loadByHandle (handle: string): Promise<MAccountDefault> {
    const [ accountName, host ] = handle.split('@')

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
            where: ActorModel.wherePreferredUsername(name)
          }
        ]
      }

      return AccountModel.findOne(query)
    }

    return ModelCache.Instance.doCache({
      cacheType: 'server-account',
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
          where: ActorModel.wherePreferredUsername(name),
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

  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------

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

  static listLocalsForSitemap (sort: string): Promise<MAccountHost[]> {
    return AccountModel.unscoped().findAll({
      attributes: [],
      offset: 0,
      order: getSort(sort),
      include: [
        {
          attributes: [ 'preferredUsername', 'serverId' ],
          model: ActorModel.unscoped(),
          where: {
            serverId: null
          }
        },
        {
          attributes: [ 'id' ],
          model: VideoChannelModel.unscoped(),
          required: true,
          where: {
            [Op.and]: [
              literal(`EXISTS (SELECT 1 FROM "video" WHERE "privacy" = ${VideoPrivacy.PUBLIC} AND "channelId" = "VideoChannels"."id")`)
            ]
          }
        }
      ]
    })
  }

  // ---------------------------------------------------------------------------

  toFormattedJSON (this: MAccountFormattable): Account {
    return {
      ...this.Actor.toFormattedJSON(false),

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
      avatars: actor.avatars
    }
  }

  async toActivityPubObject (this: MAccountAP): Promise<ActivityPubActor> {
    const obj = await this.Actor.toActivityPubObject(this.name)

    return Object.assign(obj, {
      url: [
        {
          type: 'Link',
          mediaType: 'text/html',
          href: this.getClientUrl(true)
        },
        {
          type: 'Link',
          mediaType: 'text/html',
          href: this.getClientUrl(false)
        },
        {
          type: 'Link',
          mediaType: 'text/html',
          href: this.Actor.url
        }
      ] as ActivityUrlObject[],

      summary: this.description
    })
  }

  isLocal () {
    return this.Actor.isLocal()
  }

  isOutdated () {
    return this.Actor.isOutdated()
  }

  getDisplayName () {
    return this.name
  }

  // Avoid error when running this method on MAccount... | MChannel...
  getClientUrl (this: MAccountIdHost | MChannelIdHost, channelsSuffix = true) {
    const suffix = channelsSuffix
      ? '/video-channels'
      : ''

    return WEBSERVER.URL + '/a/' + this.Actor.getIdentifier() + suffix
  }

  isBlocked () {
    return this.BlockedBy && this.BlockedBy.length !== 0
  }
}
