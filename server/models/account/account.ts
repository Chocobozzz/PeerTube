import * as Sequelize from 'sequelize'
import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  Column,
  CreatedAt,
  Default,
  DefaultScope,
  ForeignKey,
  HasMany,
  Is,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { Account } from '../../../shared/models/actors'
import { isAccountDescriptionValid } from '../../helpers/custom-validators/accounts'
import { sendDeleteActor } from '../../lib/activitypub/send'
import { ActorModel } from '../activitypub/actor'
import { ApplicationModel } from '../application/application'
import { AvatarModel } from '../avatar/avatar'
import { ServerModel } from '../server/server'
import { getSort, throwIfNotValid } from '../utils'
import { VideoChannelModel } from '../video/video-channel'
import { VideoCommentModel } from '../video/video-comment'
import { UserModel } from './user'

@DefaultScope({
  include: [
    {
      model: () => ActorModel, // Default scope includes avatar and server
      required: true
    }
  ]
})
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
  @Is('AccountDescription', value => throwIfNotValid(value, isAccountDescriptionValid, 'description'))
  @Column
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

  static load (id: number) {
    return AccountModel.findById(id)
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

  static loadLocalByName (name: string) {
    const query = {
      where: {
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

  static loadByUrl (url: string, transaction?: Sequelize.Transaction) {
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

  toFormattedJSON (): Account {
    const actor = this.Actor.toFormattedJSON()
    const account = {
      id: this.id,
      displayName: this.getDisplayName(),
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }

    return Object.assign(actor, account)
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

  getDisplayName () {
    return this.name
  }
}
