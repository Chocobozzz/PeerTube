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
import { IFindOptions } from 'sequelize-typescript/lib/interfaces/IFindOptions'
import { activityPubCollection } from '../../helpers'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub'
import { isVideoChannelDescriptionValid, isVideoChannelNameValid } from '../../helpers/custom-validators/video-channels'
import { CONSTRAINTS_FIELDS } from '../../initializers'
import { getAnnounceActivityPubUrl } from '../../lib/activitypub'
import { sendDeleteVideoChannel } from '../../lib/activitypub/send'
import { AccountModel } from '../account/account'
import { ServerModel } from '../server/server'
import { getSort, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { VideoChannelShareModel } from './video-channel-share'

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

  @AllowNull(false)
  @Is('VideoChannelUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_CHANNELS.URL.max))
  url: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

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
      order: [ getSort(sort) ],
      include: [
        {
          model: AccountModel,
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

  static loadByUUID (uuid: string, t?: Sequelize.Transaction) {
    const query: IFindOptions<VideoChannelModel> = {
      where: {
        uuid
      }
    }

    if (t !== undefined) query.transaction = t

    return VideoChannelModel.findOne(query)
  }

  static loadByUrl (url: string, t?: Sequelize.Transaction) {
    const query: IFindOptions<VideoChannelModel> = {
      where: {
        url
      },
      include: [ AccountModel ]
    }

    if (t !== undefined) query.transaction = t

    return VideoChannelModel.findOne(query)
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

  static loadByHostAndUUID (fromHost: string, uuid: string, t?: Sequelize.Transaction) {
    const query: IFindOptions<VideoChannelModel> = {
      where: {
        uuid
      },
      include: [
        {
          model: AccountModel,
          include: [
            {
              model: ServerModel,
              required: true,
              where: {
                host: fromHost
              }
            }
          ]
        }
      ]
    }

    if (t !== undefined) query.transaction = t

    return VideoChannelModel.findOne(query)
  }

  static loadByIdAndAccount (id: number, accountId: number) {
    const options = {
      where: {
        id,
        accountId
      },
      include: [
        {
          model: AccountModel,
          include: [ { model: ServerModel, required: false } ]
        }
      ]
    }

    return VideoChannelModel.findOne(options)
  }

  static loadAndPopulateAccount (id: number) {
    const options = {
      include: [
        {
          model: AccountModel,
          include: [ { model: ServerModel, required: false } ]
        }
      ]
    }

    return VideoChannelModel.findById(id, options)
  }

  static loadByUUIDAndPopulateAccount (uuid: string) {
    const options = {
      where: {
        uuid
      },
      include: [
        {
          model: AccountModel,
          include: [ { model: ServerModel, required: false } ]
        }
      ]
    }

    return VideoChannelModel.findOne(options)
  }

  static loadAndPopulateAccountAndVideos (id: number) {
    const options = {
      include: [
        {
          model: AccountModel,
          include: [ { model: ServerModel, required: false } ]
        },
        VideoModel
      ]
    }

    return VideoChannelModel.findById(id, options)
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
    let sharesObject
    if (Array.isArray(this.VideoChannelShares)) {
      const shares: string[] = []

      for (const videoChannelShare of this.VideoChannelShares) {
        const shareUrl = getAnnounceActivityPubUrl(this.url, videoChannelShare.Account)
        shares.push(shareUrl)
      }

      sharesObject = activityPubCollection(shares)
    }

    return {
      type: 'VideoChannel' as 'VideoChannel',
      id: this.url,
      uuid: this.uuid,
      content: this.description,
      name: this.name,
      published: this.createdAt.toISOString(),
      updated: this.updatedAt.toISOString(),
      shares: sharesObject
    }
  }
}
