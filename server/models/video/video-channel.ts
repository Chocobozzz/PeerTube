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
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { IFindOptions } from 'sequelize-typescript/lib/interfaces/IFindOptions'
import { isVideoChannelDescriptionValid, isVideoChannelNameValid } from '../../helpers/custom-validators/video-channels'
import { sendDeleteVideoChannel } from '../../lib/activitypub/send'
import { AccountModel } from '../account/account'
import { ActorModel } from '../activitypub/actor'
import { ServerModel } from '../server/server'
import { getSort, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { VideoChannelShareModel } from './video-channel-share'

enum ScopeNames {
  WITH_ACCOUNT = 'WITH_ACCOUNT',
  WITH_VIDEOS = 'WITH_VIDEOS'
}

@Scopes({
  [ScopeNames.WITH_ACCOUNT]: {
    include: [
      {
        model: () => AccountModel,
        include: [ { model: () => ServerModel, required: false } ]
      }
    ]
  },
  [ScopeNames.WITH_VIDEOS]: {
    include: [
      () => VideoModel
    ]
  }
})
@Table({
  tableName: 'videoChannel',
  indexes: [
    {
      fields: [ 'accountId' ]
    }
  ]
})
export class VideoChannelModel extends Model<VideoChannelModel> {

  @AllowNull(false)
  @Default(DataType.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  uuid: string

  @AllowNull(false)
  @Is('VideoChannelName', value => throwIfNotValid(value, isVideoChannelNameValid, 'name'))
  @Column
  name: string

  @AllowNull(true)
  @Is('VideoChannelDescription', value => throwIfNotValid(value, isVideoChannelDescriptionValid, 'description'))
  @Column
  description: string

  @AllowNull(false)
  @Column
  remote: boolean

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

  @ForeignKey(() => AccountModel)
  @Column
  accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Account: AccountModel

  @HasMany(() => VideoModel, {
    foreignKey: {
      name: 'channelId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Videos: VideoModel[]

  @HasMany(() => VideoChannelShareModel, {
    foreignKey: {
      name: 'channelId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  VideoChannelShares: VideoChannelShareModel[]

  @AfterDestroy
  static sendDeleteIfOwned (instance: VideoChannelModel) {
    if (instance.isOwned()) {
      return sendDeleteVideoChannel(instance, undefined)
    }

    return undefined
  }

  static countByAccount (accountId: number) {
    const query = {
      where: {
        accountId
      }
    }

    return VideoChannelModel.count(query)
  }

  static listForApi (start: number, count: number, sort: string) {
    const query = {
      offset: start,
      limit: count,
      order: [ getSort(sort) ]
    }

    return VideoChannelModel.scope(ScopeNames.WITH_ACCOUNT).findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static listByAccount (accountId: number) {
    const query = {
      order: [ getSort('createdAt') ],
      include: [
        {
          model: AccountModel,
          where: {
            id: accountId
          },
          required: true,
          include: [ { model: ServerModel, required: false } ]
        }
      ]
    }

    return VideoChannelModel.findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static loadByUrl (url: string, t?: Sequelize.Transaction) {
    const query: IFindOptions<VideoChannelModel> = {
      include: [
        {
          model: ActorModel,
          required: true,
          where: {
            url
          }
        }
      ]
    }

    if (t !== undefined) query.transaction = t

    return VideoChannelModel.scope(ScopeNames.WITH_ACCOUNT).findOne(query)
  }

  static loadByUUIDOrUrl (uuid: string, url: string, t?: Sequelize.Transaction) {
    const query: IFindOptions<VideoChannelModel> = {
      where: {
        [ Sequelize.Op.or ]: [
          { uuid },
          { url }
        ]
      }
    }

    if (t !== undefined) query.transaction = t

    return VideoChannelModel.findOne(query)
  }

  static loadByIdAndAccount (id: number, accountId: number) {
    const options = {
      where: {
        id,
        accountId
      }
    }

    return VideoChannelModel.scope(ScopeNames.WITH_ACCOUNT).findOne(options)
  }

  static loadAndPopulateAccount (id: number) {
    return VideoChannelModel.scope(ScopeNames.WITH_ACCOUNT).findById(id)
  }

  static loadByUUIDAndPopulateAccount (uuid: string) {
    const options = {
      where: {
        uuid
      }
    }

    return VideoChannelModel.scope(ScopeNames.WITH_ACCOUNT).findOne(options)
  }

  static loadAndPopulateAccountAndVideos (id: number) {
    const options = {
      include: [
        VideoModel
      ]
    }

    return VideoChannelModel.scope([ ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_VIDEOS ]).findById(id, options)
  }

  isOwned () {
    return this.remote === false
  }

  toFormattedJSON () {
    const json = {
      id: this.id,
      uuid: this.uuid,
      name: this.name,
      description: this.description,
      isLocal: this.isOwned(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }

    if (this.Account !== undefined) {
      json[ 'owner' ] = {
        name: this.Account.name,
        uuid: this.Account.uuid
      }
    }

    if (Array.isArray(this.Videos)) {
      json[ 'videos' ] = this.Videos.map(v => v.toFormattedJSON())
    }

    return json
  }

  toActivityPubObject () {
    return this.Actor.toActivityPubObject(this.name, this.uuid, 'VideoChannel')
  }
}
