import {
  AllowNull, BeforeDestroy, BelongsTo, Column, CreatedAt, DefaultScope, ForeignKey, HasMany, Is, Model, Scopes, Table,
  UpdatedAt, Default, DataType
} from 'sequelize-typescript'
import { ActivityPubActor } from '../../../shared/models/activitypub'
import { VideoChannel } from '../../../shared/models/videos'
import {
  isVideoChannelDescriptionValid, isVideoChannelNameValid,
  isVideoChannelSupportValid
} from '../../helpers/custom-validators/video-channels'
import { logger } from '../../helpers/logger'
import { sendDeleteActor } from '../../lib/activitypub/send'
import { AccountModel } from '../account/account'
import { ActorModel } from '../activitypub/actor'
import { getSort, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { CONSTRAINTS_FIELDS } from '../../initializers'

enum ScopeNames {
  WITH_ACCOUNT = 'WITH_ACCOUNT',
  WITH_ACTOR = 'WITH_ACTOR',
  WITH_VIDEOS = 'WITH_VIDEOS'
}

@DefaultScope({
  include: [
    {
      model: () => ActorModel,
      required: true
    }
  ]
})
@Scopes({
  [ScopeNames.WITH_ACCOUNT]: {
    include: [
      {
        model: () => AccountModel.unscoped(),
        required: true,
        include: [
          {
            model: () => ActorModel.unscoped(),
            required: true
          }
        ]
      }
    ]
  },
  [ScopeNames.WITH_VIDEOS]: {
    include: [
      () => VideoModel
    ]
  },
  [ScopeNames.WITH_ACTOR]: {
    include: [
      () => ActorModel
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
  @Is('VideoChannelName', value => throwIfNotValid(value, isVideoChannelNameValid, 'name'))
  @Column
  name: string

  @AllowNull(true)
  @Default(null)
  @Is('VideoChannelDescription', value => throwIfNotValid(value, isVideoChannelDescriptionValid, 'description'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_CHANNELS.DESCRIPTION.max))
  description: string

  @AllowNull(true)
  @Default(null)
  @Is('VideoChannelSupport', value => throwIfNotValid(value, isVideoChannelSupportValid, 'support'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_CHANNELS.SUPPORT.max))
  support: string

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
    hooks: true
  })
  Account: AccountModel

  @HasMany(() => VideoModel, {
    foreignKey: {
      name: 'channelId',
      allowNull: false
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  Videos: VideoModel[]

  @BeforeDestroy
  static async sendDeleteIfOwned (instance: VideoChannelModel, options) {
    if (!instance.Actor) {
      instance.Actor = await instance.$get('Actor', { transaction: options.transaction }) as ActorModel
    }

    if (instance.Actor.isOwned()) {
      logger.debug('Sending delete of actor of video channel %s.', instance.Actor.url)

      return sendDeleteActor(instance.Actor, options.transaction)
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
      order: getSort(sort)
    }

    return VideoChannelModel
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static listByAccount (accountId: number) {
    const query = {
      order: getSort('createdAt'),
      include: [
        {
          model: AccountModel,
          where: {
            id: accountId
          },
          required: true
        }
      ]
    }

    return VideoChannelModel
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static loadByIdAndAccount (id: number, accountId: number) {
    const options = {
      where: {
        id,
        accountId
      }
    }

    return VideoChannelModel
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findOne(options)
  }

  static loadAndPopulateAccount (id: number) {
    return VideoChannelModel
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findById(id)
  }

  static loadByUUIDAndPopulateAccount (uuid: string) {
    const options = {
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

    return VideoChannelModel
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findOne(options)
  }

  static loadAndPopulateAccountAndVideos (id: number) {
    const options = {
      include: [
        VideoModel
      ]
    }

    return VideoChannelModel
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_VIDEOS ])
      .findById(id, options)
  }

  toFormattedJSON (): VideoChannel {
    const actor = this.Actor.toFormattedJSON()
    const videoChannel = {
      id: this.id,
      displayName: this.name,
      description: this.description,
      support: this.support,
      isLocal: this.Actor.isOwned(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ownerAccount: undefined,
      videos: undefined
    }

    if (this.Account) videoChannel.ownerAccount = this.Account.toFormattedJSON()

    return Object.assign(actor, videoChannel)
  }

  toActivityPubObject (): ActivityPubActor {
    const obj = this.Actor.toActivityPubObject(this.name, 'VideoChannel')

    return Object.assign(obj, {
      summary: this.description,
      support: this.support,
      attributedTo: [
        {
          type: 'Person' as 'Person',
          id: this.Account.Actor.url
        }
      ]
    })
  }
}
