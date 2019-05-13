import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  Column,
  CreatedAt, DataType,
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
import { CONSTRAINTS_FIELDS, WEBSERVER } from '../../initializers/constants'
import { Op, Transaction, WhereOptions } from 'sequelize'

export enum ScopeNames {
  SUMMARY = 'SUMMARY'
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
  [ ScopeNames.SUMMARY ]: (whereActor?: WhereOptions) => {
    return {
      attributes: [ 'id', 'name' ],
      include: [
        {
          attributes: [ 'id', 'uuid', 'preferredUsername', 'url', 'serverId', 'avatarId' ],
          model: ActorModel.unscoped(),
          required: true,
          where: whereActor,
          include: [
            {
              attributes: [ 'host' ],
              model: ServerModel.unscoped(),
              required: false
            },
            {
              model: AvatarModel.unscoped(),
              required: false
            }
          ]
        }
      ]
    }
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
      allowNull: false
    },
    onDelete: 'cascade',
    hooks: true
  })
  VideoComments: VideoCommentModel[]

  @BeforeDestroy
  static async sendDeleteIfOwned (instance: AccountModel, options) {
    if (!instance.Actor) {
      instance.Actor = await instance.$get('Actor', { transaction: options.transaction }) as ActorModel
    }

    if (instance.isOwned()) {
      return sendDeleteActor(instance.Actor, options.transaction)
    }

    return undefined
  }

  static load (id: number, transaction?: Transaction) {
    return AccountModel.findByPk(id, { transaction })
  }

  static loadByUUID (uuid: string) {
    const query = {
      include: [
        {
          model: ActorModel,
          required: true,
          where: {
            uuid
          }
        }
      ]
    }

    return AccountModel.findOne(query)
  }

  static loadByNameWithHost (nameWithHost: string) {
    const [ accountName, host ] = nameWithHost.split('@')

    if (!host || host === WEBSERVER.HOST) return AccountModel.loadLocalByName(accountName)

    return AccountModel.loadByNameAndHost(accountName, host)
  }

  static loadLocalByName (name: string) {
    const query = {
      where: {
        [ Op.or ]: [
          {
            userId: {
              [ Op.ne ]: null
            }
          },
          {
            applicationId: {
              [ Op.ne ]: null
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

  static loadByNameAndHost (name: string, host: string) {
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

  static loadByUrl (url: string, transaction?: Transaction) {
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

  static listLocalsForSitemap (sort: string) {
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

  toFormattedJSON (): Account {
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

  toFormattedSummaryJSON (): AccountSummary {
    const actor = this.Actor.toFormattedJSON()

    return {
      id: this.id,
      uuid: actor.uuid,
      name: actor.name,
      displayName: this.getDisplayName(),
      url: actor.url,
      host: actor.host,
      avatar: actor.avatar
    }
  }

  toActivityPubObject () {
    const obj = this.Actor.toActivityPubObject(this.name, 'Account')

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
}
