import * as Sequelize from 'sequelize'
import {
  AfterDestroy,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DefaultScope,
  ForeignKey,
  HasMany,
  Is,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isUserUsernameValid } from '../../helpers/custom-validators/users'
import { sendDeleteActor } from '../../lib/activitypub/send'
import { ActorModel } from '../activitypub/actor'
import { ApplicationModel } from '../application/application'
import { ServerModel } from '../server/server'
import { throwIfNotValid } from '../utils'
import { VideoChannelModel } from '../video/video-channel'
import { UserModel } from './user'

@DefaultScope({
  include: [
    {
      model: () => ActorModel,
      required: true,
      include: [
        {
          model: () => ServerModel,
          required: false
        }
      ]
    }
  ]
})
@Table({
  tableName: 'account'
})
export class AccountModel extends Model<AccountModel> {

  @AllowNull(false)
  @Is('AccountName', value => throwIfNotValid(value, isUserUsernameValid, 'account name'))
  @Column
  name: string

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
  Account: ApplicationModel

  @HasMany(() => VideoChannelModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade',
    hooks: true
  })
  VideoChannels: VideoChannelModel[]

  @AfterDestroy
  static sendDeleteIfOwned (instance: AccountModel) {
    if (instance.isOwned()) {
      return sendDeleteActor(instance.Actor, undefined)
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

  toFormattedJSON () {
    const actor = this.Actor.toFormattedJSON()
    const account = {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }

    return Object.assign(actor, account)
  }

  toActivityPubObject () {
    return this.Actor.toActivityPubObject(this.name, 'Account')
  }

  isOwned () {
    return this.Actor.isOwned()
  }
}
