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
import { VideoChannel, VideoChannelSummary } from '../../../shared/models/videos'
import {
  isVideoChannelDescriptionValid,
  isVideoChannelNameValid,
  isVideoChannelSupportValid
} from '../../helpers/custom-validators/video-channels'
import { sendDeleteActor } from '../../lib/activitypub/send'
import { AccountModel, ScopeNames as AccountModelScopeNames } from '../account/account'
import { ActorModel, unusedActorAttributesForAPI } from '../activitypub/actor'
import { buildServerIdsFollowedBy, buildTrigramSearchIndex, createSimilarityAttribute, getSort, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { CONSTRAINTS_FIELDS, WEBSERVER } from '../../initializers/constants'
import { ServerModel } from '../server/server'
import { FindOptions, ModelIndexesOptions, Op } from 'sequelize'
import { AvatarModel } from '../avatar/avatar'
import { VideoPlaylistModel } from './video-playlist'

// FIXME: Define indexes here because there is an issue with TS and Sequelize.literal when called directly in the annotation
const indexes: ModelIndexesOptions[] = [
  buildTrigramSearchIndex('video_channel_name_trigram', 'name'),

  {
    fields: [ 'accountId' ]
  },
  {
    fields: [ 'actorId' ]
  }
]

export enum ScopeNames {
  AVAILABLE_FOR_LIST = 'AVAILABLE_FOR_LIST',
  WITH_ACCOUNT = 'WITH_ACCOUNT',
  WITH_ACTOR = 'WITH_ACTOR',
  WITH_VIDEOS = 'WITH_VIDEOS',
  SUMMARY = 'SUMMARY'
}

type AvailableForListOptions = {
  actorId: number
}

@DefaultScope(() => ({
  include: [
    {
      model: ActorModel,
      required: true
    }
  ]
}))
@Scopes(() => ({
  [ScopeNames.SUMMARY]: (withAccount = false) => {
    const base: FindOptions = {
      attributes: [ 'name', 'description', 'id', 'actorId' ],
      include: [
        {
          attributes: [ 'uuid', 'preferredUsername', 'url', 'serverId', 'avatarId' ],
          model: ActorModel.unscoped(),
          required: true,
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

    if (withAccount === true) {
      base.include.push({
        model: AccountModel.scope(AccountModelScopeNames.SUMMARY),
        required: true
      })
    }

    return base
  },
  [ScopeNames.AVAILABLE_FOR_LIST]: (options: AvailableForListOptions) => {
    // Only list local channels OR channels that are on an instance followed by actorId
    const inQueryInstanceFollow = buildServerIdsFollowedBy(options.actorId)

    return {
      include: [
        {
          attributes: {
            exclude: unusedActorAttributesForAPI
          },
          model: ActorModel,
          where: {
            [Op.or]: [
              {
                serverId: null
              },
              {
                serverId: {
                  [ Op.in ]: Sequelize.literal(inQueryInstanceFollow)
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
        model: AccountModel,
        required: true
      }
    ]
  },
  [ScopeNames.WITH_VIDEOS]: {
    include: [
      VideoModel
    ]
  },
  [ScopeNames.WITH_ACTOR]: {
    include: [
      ActorModel
    ]
  }
}))
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
  @Is('VideoChannelDescription', value => throwIfNotValid(value, isVideoChannelDescriptionValid, 'description', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_CHANNELS.DESCRIPTION.max))
  description: string

  @AllowNull(true)
  @Default(null)
  @Is('VideoChannelSupport', value => throwIfNotValid(value, isVideoChannelSupportValid, 'support', true))
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

  @HasMany(() => VideoPlaylistModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  VideoPlaylists: VideoPlaylistModel[]

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

    return VideoChannelModel
      .unscoped()
      .findAll(query)
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
        [Op.or]: [
          Sequelize.literal(
            'lower(immutable_unaccent("VideoChannelModel"."name")) % lower(immutable_unaccent(' + escapedSearch + '))'
          ),
          Sequelize.literal(
            'lower(immutable_unaccent("VideoChannelModel"."name")) LIKE lower(immutable_unaccent(' + escapedLikeSearch + '))'
          )
        ]
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

  static loadByIdAndPopulateAccount (id: number) {
    return VideoChannelModel.unscoped()
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findByPk(id)
  }

  static loadByIdAndAccount (id: number, accountId: number) {
    const query = {
      where: {
        id,
        accountId
      }
    }

    return VideoChannelModel.unscoped()
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findOne(query)
  }

  static loadAndPopulateAccount (id: number) {
    return VideoChannelModel.unscoped()
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findByPk(id)
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

  static loadByNameWithHostAndPopulateAccount (nameWithHost: string) {
    const [ name, host ] = nameWithHost.split('@')

    if (!host || host === WEBSERVER.HOST) return VideoChannelModel.loadLocalByNameAndPopulateAccount(name)

    return VideoChannelModel.loadByNameAndHostAndPopulateAccount(name, host)
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

    return VideoChannelModel.unscoped()
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

    return VideoChannelModel.unscoped()
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT ])
      .findOne(query)
  }

  static loadAndPopulateAccountAndVideos (id: number) {
    const options = {
      include: [
        VideoModel
      ]
    }

    return VideoChannelModel.unscoped()
      .scope([ ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_VIDEOS ])
      .findByPk(id, options)
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

  toFormattedSummaryJSON (): VideoChannelSummary {
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

  isOutdated () {
    return this.Actor.isOutdated()
  }
}
