import * as Sequelize from 'sequelize'
import {
  AfterDestroy,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Is,
  IsUUID,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isUserUsernameValid } from '../../helpers/custom-validators/users'
import { sendDeleteAccount } from '../../lib/activitypub/send'
import { ActorModel } from '../activitypub/actor'
import { ApplicationModel } from '../application/application'
import { ServerModel } from '../server/server'
import { throwIfNotValid } from '../utils'
import { VideoChannelModel } from '../video/video-channel'
import { UserModel } from './user'

@Table({
  tableName: 'account',
  indexes: [
    {
      fields: [ 'name' ]
    },
    {
      fields: [ 'serverId' ]
    },
    {
      fields: [ 'userId' ],
      unique: true
    },
    {
      fields: [ 'applicationId' ],
      unique: true
    },
    {
      fields: [ 'name', 'serverId', 'applicationId' ],
      unique: true
    }
  ]
})
export class AccountModel extends Model<AccountModel> {

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

  @AfterDestroy
  static sendDeleteIfOwned (instance: AccountModel) {
    if (instance.isOwned()) {
      return sendDeleteAccount(instance, undefined)
    }

    return undefined
  }

  static loadApplication () {
    return AccountModel.findOne({
      include: [
        {
          model: ApplicationModel,
          required: true
        }
      ]
    })
  }

  static load (id: number) {
    return AccountModel.findById(id)
  }

  static loadByUUID (uuid: string) {
    const query = {
      where: {
        uuid
      }
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

  static loadByNameAndHost (name: string, host: string) {
    const query = {
      where: {
        name
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

  static listByFollowersUrls (followersUrls: string[], transaction?: Sequelize.Transaction) {
    const query = {
      include: [
        {
          model: ActorModel,
          required: true,
          where: {
            followersUrl: {
              [ Sequelize.Op.in ]: followersUrls
            }
          }
        }
      ],
      transaction
    }

    return AccountModel.findAll(query)
  }

  toFormattedJSON () {
    const actor = this.Actor.toFormattedJSON()
    const account = {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }

    return Object.assign(actor, account)
  }

  toActivityPubObject () {
    return this.Actor.toActivityPubObject(this.name, this.uuid, 'Account')
  }

  isOwned () {
    return this.Actor.isOwned()
  }
}
