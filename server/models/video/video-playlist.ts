import {
  AllowNull,
  BeforeDestroy,
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
import * as Sequelize from 'sequelize'
import { VideoPlaylistPrivacy } from '../../../shared/models/videos/playlist/video-playlist-privacy.model'
import { buildServerIdsFollowedBy, buildWhereIdOrUUID, getSort, throwIfNotValid } from '../utils'
import {
  isVideoPlaylistDescriptionValid,
  isVideoPlaylistNameValid,
  isVideoPlaylistPrivacyValid
} from '../../helpers/custom-validators/video-playlists'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { CONFIG, CONSTRAINTS_FIELDS, STATIC_PATHS, THUMBNAILS_SIZE, VIDEO_PLAYLIST_PRIVACIES } from '../../initializers'
import { VideoPlaylist } from '../../../shared/models/videos/playlist/video-playlist.model'
import { AccountModel, ScopeNames as AccountScopeNames } from '../account/account'
import { ScopeNames as VideoChannelScopeNames, VideoChannelModel } from './video-channel'
import { join } from 'path'
import { VideoPlaylistElementModel } from './video-playlist-element'
import { PlaylistObject } from '../../../shared/models/activitypub/objects/playlist-object'
import { activityPubCollectionPagination } from '../../helpers/activitypub'
import { remove } from 'fs-extra'
import { logger } from '../../helpers/logger'

enum ScopeNames {
  AVAILABLE_FOR_LIST = 'AVAILABLE_FOR_LIST',
  WITH_VIDEOS_LENGTH = 'WITH_VIDEOS_LENGTH',
  WITH_ACCOUNT_AND_CHANNEL = 'WITH_ACCOUNT_AND_CHANNEL'
}

type AvailableForListOptions = {
  followerActorId: number
  accountId?: number,
  videoChannelId?: number
  privateAndUnlisted?: boolean
}

@Scopes({
  [ScopeNames.WITH_VIDEOS_LENGTH]: {
    attributes: {
      include: [
        [
          Sequelize.literal('(SELECT COUNT("id") FROM "videoPlaylistElement" WHERE "videoPlaylistId" = "VideoPlaylistModel"."id")'),
          'videosLength'
        ]
      ]
    }
  },
  [ScopeNames.WITH_ACCOUNT_AND_CHANNEL]: {
    include: [
      {
        model: () => AccountModel.scope(AccountScopeNames.SUMMARY),
        required: true
      },
      {
        model: () => VideoChannelModel.scope(VideoChannelScopeNames.SUMMARY),
        required: false
      }
    ]
  },
  [ScopeNames.AVAILABLE_FOR_LIST]: (options: AvailableForListOptions) => {
    // Only list local playlists OR playlists that are on an instance followed by actorId
    const inQueryInstanceFollow = buildServerIdsFollowedBy(options.followerActorId)
    const actorWhere = {
      [ Sequelize.Op.or ]: [
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

    const whereAnd: any[] = []

    if (options.privateAndUnlisted !== true) {
      whereAnd.push({
        privacy: VideoPlaylistPrivacy.PUBLIC
      })
    }

    if (options.accountId) {
      whereAnd.push({
        ownerAccountId: options.accountId
      })
    }

    if (options.videoChannelId) {
      whereAnd.push({
        videoChannelId: options.videoChannelId
      })
    }

    const where = {
      [Sequelize.Op.and]: whereAnd
    }

    const accountScope = {
      method: [ AccountScopeNames.SUMMARY, actorWhere ]
    }

    return {
      where,
      include: [
        {
          model: AccountModel.scope(accountScope),
          required: true
        },
        {
          model: VideoChannelModel.scope(VideoChannelScopeNames.SUMMARY),
          required: false
        }
      ]
    }
  }
})

@Table({
  tableName: 'videoPlaylist',
  indexes: [
    {
      fields: [ 'ownerAccountId' ]
    },
    {
      fields: [ 'videoChannelId' ]
    },
    {
      fields: [ 'url' ],
      unique: true
    }
  ]
})
export class VideoPlaylistModel extends Model<VideoPlaylistModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Is('VideoPlaylistName', value => throwIfNotValid(value, isVideoPlaylistNameValid, 'name'))
  @Column
  name: string

  @AllowNull(true)
  @Is('VideoPlaylistDescription', value => throwIfNotValid(value, isVideoPlaylistDescriptionValid, 'description'))
  @Column
  description: string

  @AllowNull(false)
  @Is('VideoPlaylistPrivacy', value => throwIfNotValid(value, isVideoPlaylistPrivacyValid, 'privacy'))
  @Column
  privacy: VideoPlaylistPrivacy

  @AllowNull(false)
  @Is('VideoPlaylistUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_PLAYLISTS.URL.max))
  url: string

  @AllowNull(false)
  @Default(DataType.UUIDV4)
  @IsUUID(4)
  @Column(DataType.UUID)
  uuid: string

  @ForeignKey(() => AccountModel)
  @Column
  ownerAccountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  OwnerAccount: AccountModel

  @ForeignKey(() => VideoChannelModel)
  @Column
  videoChannelId: number

  @BelongsTo(() => VideoChannelModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  VideoChannel: VideoChannelModel

  @HasMany(() => VideoPlaylistElementModel, {
    foreignKey: {
      name: 'videoPlaylistId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
  VideoPlaylistElements: VideoPlaylistElementModel[]

  // Calculated field
  videosLength?: number

  @BeforeDestroy
  static async removeFiles (instance: VideoPlaylistModel) {
    logger.info('Removing files of video playlist %s.', instance.url)

    return instance.removeThumbnail()
  }

  static listForApi (options: {
    followerActorId: number
    start: number,
    count: number,
    sort: string,
    accountId?: number,
    videoChannelId?: number,
    privateAndUnlisted?: boolean
  }) {
    const query = {
      offset: options.start,
      limit: options.count,
      order: getSort(options.sort)
    }

    const scopes = [
      {
        method: [
          ScopeNames.AVAILABLE_FOR_LIST,
          {
            followerActorId: options.followerActorId,
            accountId: options.accountId,
            videoChannelId: options.videoChannelId,
            privateAndUnlisted: options.privateAndUnlisted
          } as AvailableForListOptions
        ]
      } as any, // FIXME: typings
      ScopeNames.WITH_VIDEOS_LENGTH
    ]

    return VideoPlaylistModel
      .scope(scopes)
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static listUrlsOfForAP (accountId: number, start: number, count: number) {
    const query = {
      attributes: [ 'url' ],
      offset: start,
      limit: count,
      where: {
        ownerAccountId: accountId
      }
    }

    return VideoPlaylistModel.findAndCountAll(query)
                             .then(({ rows, count }) => {
                               return { total: count, data: rows.map(p => p.url) }
                             })
  }

  static doesPlaylistExist (url: string) {
    const query = {
      attributes: [],
      where: {
        url
      }
    }

    return VideoPlaylistModel
      .findOne(query)
      .then(e => !!e)
  }

  static load (id: number | string, transaction: Sequelize.Transaction) {
    const where = buildWhereIdOrUUID(id)

    const query = {
      where,
      transaction
    }

    return VideoPlaylistModel
      .scope([ ScopeNames.WITH_ACCOUNT_AND_CHANNEL, ScopeNames.WITH_VIDEOS_LENGTH ])
      .findOne(query)
  }

  static getPrivacyLabel (privacy: VideoPlaylistPrivacy) {
    return VIDEO_PLAYLIST_PRIVACIES[privacy] || 'Unknown'
  }

  getThumbnailName () {
    const extension = '.jpg'

    return 'playlist-' + this.uuid + extension
  }

  getThumbnailUrl () {
    return CONFIG.WEBSERVER.URL + STATIC_PATHS.THUMBNAILS + this.getThumbnailName()
  }

  getThumbnailStaticPath () {
    return join(STATIC_PATHS.THUMBNAILS, this.getThumbnailName())
  }

  removeThumbnail () {
    const thumbnailPath = join(CONFIG.STORAGE.THUMBNAILS_DIR, this.getThumbnailName())
    return remove(thumbnailPath)
      .catch(err => logger.warn('Cannot delete thumbnail %s.', thumbnailPath, { err }))
  }

  isOwned () {
    return this.OwnerAccount.isOwned()
  }

  toFormattedJSON (): VideoPlaylist {
    return {
      id: this.id,
      uuid: this.uuid,
      isLocal: this.isOwned(),

      displayName: this.name,
      description: this.description,
      privacy: {
        id: this.privacy,
        label: VideoPlaylistModel.getPrivacyLabel(this.privacy)
      },

      thumbnailPath: this.getThumbnailStaticPath(),

      videosLength: this.videosLength,

      createdAt: this.createdAt,
      updatedAt: this.updatedAt,

      ownerAccount: this.OwnerAccount.toFormattedSummaryJSON(),
      videoChannel: this.VideoChannel.toFormattedSummaryJSON()
    }
  }

  toActivityPubObject (): Promise<PlaylistObject> {
    const handler = (start: number, count: number) => {
      return VideoPlaylistElementModel.listUrlsOfForAP(this.id, start, count)
    }

    return activityPubCollectionPagination(this.url, handler, null)
      .then(o => {
        return Object.assign(o, {
          type: 'Playlist' as 'Playlist',
          name: this.name,
          content: this.description,
          uuid: this.uuid,
          attributedTo: this.VideoChannel ? [ this.VideoChannel.Actor.url ] : [],
          icon: {
            type: 'Image' as 'Image',
            url: this.getThumbnailUrl(),
            mediaType: 'image/jpeg' as 'image/jpeg',
            width: THUMBNAILS_SIZE.width,
            height: THUMBNAILS_SIZE.height
          }
        })
      })
  }
}
