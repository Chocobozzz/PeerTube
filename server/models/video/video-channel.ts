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
  Sequelize,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { ActivityPubActor } from '../../../shared/models/activitypub'
import { VideoChannel } from '../../../shared/models/videos'
import {
  isVideoChannelDescriptionValid,
  isVideoChannelNameValid,
  isVideoChannelSupportValid
} from '../../helpers/custom-validators/video-channels'
import { sendDeleteActor } from '../../lib/activitypub/send'
import { AccountModel } from '../account/account'
import { ActorModel, unusedActorAttributesForAPI } from '../activitypub/actor'
import { buildTrigramSearchIndex, createSimilarityAttribute, getSort, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { CONSTRAINTS_FIELDS } from '../../initializers'
import { ServerModel } from '../server/server'
import { DefineIndexesOptions } from 'sequelize'

// FIXME: Define indexes here because there is an issue with TS and Sequelize.literal when called directly in the annotation
const indexes: DefineIndexesOptions[] = [
  buildTrigramSearchIndex('video_channel_name_trigram', 'name'),

  {
    fields: [ 'accountId' ]
  },
  {
    fields: [ 'actorId' ]
  }
]

enum ScopeNames {
  AVAILABLE_FOR_LIST = 'AVAILABLE_FOR_LIST',
  WITH_ACCOUNT = 'WITH_ACCOUNT',
  WITH_ACTOR = 'WITH_ACTOR',
  WITH_VIDEOS = 'WITH_VIDEOS'
}

type AvailableForListOptions = {
  actorId: number
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
  [ScopeNames.AVAILABLE_FOR_LIST]: (options: AvailableForListOptions) => {
    const actorIdNumber = parseInt(options.actorId + '', 10)

    // Only list local channels OR channels that are on an instance followed by actorId
    const inQueryInstanceFollow = '(' +
      'SELECT "actor"."serverId" FROM "actor" ' +
      'INNER JOIN "actorFollow" ON "actorFollow"."targetActorId" = actor.id ' +
      'WHERE "actorFollow"."actorId" = ' + actorIdNumber +
    ')'

    return {
      include: [
        {
          attributes: {
            exclude: unusedActorAttributesForAPI
          },
          model: ActorModel,
          where: {
            [Sequelize.Op.or]: [
              {
                serverId: null
              },
              {
                serverId: {
                  [ Sequelize.Op.in ]: Sequelize.literal(inQueryInstanceFollow)
                }
              }
            ]
          }
        },
        {
          model: AccountModel,
          required: true,
          include: [
            {
              attributes: {
                exclude: unusedActorAttributesForAPI
              },
              model: ActorModel, // Default scope includes avatar and server
              required: true
            }
          ]
        }
      ]
    }
  },
  [ScopeNames.WITH_ACCOUNT]: {
    include: [
      {
        model: () => AccountModel,
        required: true
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
  indexes
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

  static listForApi (actorId: number, start: number, count: number, sort: string) {
    const query = {
      offset: start,
      limit: count,
      order: getSort(sort)
    }

    const scopes = {
      method: [ ScopeNames.AVAILABLE_FOR_LIST, { actorId } as AvailableForListOptions ]
    }
    return VideoChannelModel
      .scope(scopes)
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static searchForApi (options: {
    actorId: number
    search: string
    start: number
    count: number
    sort: string
  }) {
    const attributesInclude = []
    const escapedSearch = VideoModel.sequelize.escape(options.search)
    const escapedLikeSearch = VideoModel.sequelize.escape('%' + options.search + '%')
    attributesInclude.push(createSimilarityAttribute('VideoChannelModel.name', options.search))

    const query = {
      attributes: {
        include: attributesInclude
      },
      offset: options.start,
      limit: options.count,
      order: getSort(options.sort),
      where: {
        id: {
          [ Sequelize.Op.in ]: Sequelize.literal(
            '(' +
              'SELECT id FROM "videoChannel" WHERE ' +
              'lower(immutable_unaccent("name")) % lower(immutable_unaccent(' + escapedSearch + ')) OR ' +
              'lower(immutable_unaccent("name")) LIKE lower(immutable_unaccent(' + escapedLikeSearch + '))' +
            ')'
          )
        }
      }
    }

    const scopes = {
      method: [ ScopeNames.AVAILABLE_FOR_LIST, { actorId: options.actorId } as AvailableForListOptions ]
    }
    return VideoChannelModel
      .scope(scopes)
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
    const query = {
      where: {
        id,
        accountId
      }
    }

    return VideoChannelModel
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findOne(query)
  }

  static loadAndPopulateAccount (id: number) {
    return VideoChannelModel
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findById(id)
  }

  static loadByUUIDAndPopulateAccount (uuid: string) {
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

    return VideoChannelModel
      .scope([ ScopeNames.WITH_ACCOUNT ])
      .findOne(query)
  }

  static loadByUrlAndPopulateAccount (url: string) {
    const query = {
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

    return VideoChannelModel
      .scope([ ScopeNames.WITH_ACCOUNT ])
      .findOne(query)
  }

  static loadLocalByNameAndPopulateAccount (name: string) {
    const query = {
      include: [
        {
          model: ActorModel,
          required: true,
          where: {
            preferredUsername: name,
            serverId: null
          }
        }
      ]
    }

    return VideoChannelModel
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findOne(query)
  }

  static loadByNameAndHostAndPopulateAccount (name: string, host: string) {
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
              where: { host }
            }
          ]
        }
      ]
    }

    return VideoChannelModel
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findOne(query)
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
      displayName: this.getDisplayName(),
      description: this.description,
      support: this.support,
      isLocal: this.Actor.isOwned(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ownerAccount: undefined
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

  getDisplayName () {
    return this.name
  }
}
