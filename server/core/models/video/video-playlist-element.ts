import {
  PlaylistElementObject,
  VideoPlaylistElement,
  VideoPlaylistElementType,
  VideoPrivacy,
  VideoPrivacyType
} from '@peertube/peertube-models'
import { MUserAccountId } from '@server/types/models/index.js'
import {
  MVideoPlaylistElement,
  MVideoPlaylistElementAP,
  MVideoPlaylistElementFormattable,
  MVideoPlaylistElementVideoThumbnail,
  MVideoPlaylistElementVideoUrl,
  MVideoPlaylistElementVideoUrlPlaylistPrivacy
} from '@server/types/models/video/video-playlist-element.js'
import { ScopeOptions, Transaction } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Is,
  IsInt,
  Min,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import validator from 'validator'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc.js'
import { CONSTRAINTS_FIELDS, USER_EXPORT_MAX_ITEMS } from '../../initializers/constants.js'
import { AccountModel } from '../account/account.js'
import { SequelizeModel, getSort, throwIfNotValid } from '../shared/index.js'
import { getNextPositionOf, increasePositionOf, reassignPositionOf } from '../shared/position.js'
import { VideoPlaylistModel } from './video-playlist.js'
import { ForAPIOptions, VideoModel, ScopeNames as VideoScopeNames } from './video.js'

@Table({
  tableName: 'videoPlaylistElement',
  indexes: [
    {
      fields: [ 'videoPlaylistId' ]
    },
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'url' ],
      unique: true
    }
  ]
})
export class VideoPlaylistElementModel extends SequelizeModel<VideoPlaylistElementModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(true)
  @Is('VideoPlaylistUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_PLAYLISTS.URL.max))
  declare url: string

  @AllowNull(false)
  @Default(1)
  @IsInt
  @Min(1)
  @Column
  declare position: number

  @AllowNull(true)
  @IsInt
  @Min(0)
  @Column
  declare startTimestamp: number

  @AllowNull(true)
  @IsInt
  @Min(0)
  @Column
  declare stopTimestamp: number

  @ForeignKey(() => VideoPlaylistModel)
  @Column
  declare videoPlaylistId: number

  @BelongsTo(() => VideoPlaylistModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare VideoPlaylist: Awaited<VideoPlaylistModel>

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  declare Video: Awaited<VideoModel>

  static deleteAllOf (videoPlaylistId: number, transaction?: Transaction) {
    const query = {
      where: {
        videoPlaylistId
      },
      transaction
    }

    return VideoPlaylistElementModel.destroy(query)
  }

  static listForApi (options: {
    start: number
    count: number
    videoPlaylistId: number
    serverAccount: AccountModel
    user?: MUserAccountId
  }) {
    const accountIds = [ options.serverAccount.id ]
    const videoScope: (ScopeOptions | string)[] = [
      VideoScopeNames.WITH_BLACKLISTED
    ]

    if (options.user) {
      accountIds.push(options.user.Account.id)
      videoScope.push({ method: [ VideoScopeNames.WITH_USER_HISTORY, options.user.id ] })
    }

    const forApiOptions: ForAPIOptions = { withAccountBlockerIds: accountIds }
    videoScope.push({
      method: [
        VideoScopeNames.FOR_API,
        forApiOptions
      ]
    })

    const findQuery = {
      offset: options.start,
      limit: options.count,
      order: getSort('position'),
      where: {
        videoPlaylistId: options.videoPlaylistId
      },
      include: [
        {
          model: VideoModel.scope(videoScope),
          required: false
        }
      ]
    }

    const countQuery = {
      where: {
        videoPlaylistId: options.videoPlaylistId
      }
    }

    return Promise.all([
      VideoPlaylistElementModel.count(countQuery),
      VideoPlaylistElementModel.findAll(findQuery)
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static loadByPlaylistAndVideo (videoPlaylistId: number, videoId: number): Promise<MVideoPlaylistElement> {
    const query = {
      where: {
        videoPlaylistId,
        videoId
      }
    }

    return VideoPlaylistElementModel.findOne(query)
  }

  static loadById (playlistElementId: number | string): Promise<MVideoPlaylistElement> {
    return VideoPlaylistElementModel.findByPk(playlistElementId)
  }

  static loadByPlaylistAndElementIdForAP (
    playlistId: number | string,
    playlistElementId: number
  ): Promise<MVideoPlaylistElementVideoUrlPlaylistPrivacy> {
    const playlistWhere = validator.default.isUUID('' + playlistId)
      ? { uuid: playlistId }
      : { id: playlistId }

    const query = {
      include: [
        {
          attributes: [ 'privacy' ],
          model: VideoPlaylistModel.unscoped(),
          where: playlistWhere
        },
        {
          attributes: [ 'url' ],
          model: VideoModel.unscoped()
        }
      ],
      where: {
        id: playlistElementId
      }
    }

    return VideoPlaylistElementModel.findOne(query)
  }

  static loadFirstElementWithVideoThumbnail (videoPlaylistId: number): Promise<MVideoPlaylistElementVideoThumbnail> {
    const query = {
      order: getSort('position'),
      where: {
        videoPlaylistId
      },
      include: [
        {
          model: VideoModel.scope(VideoScopeNames.WITH_THUMBNAILS),
          required: true
        }
      ]
    }

    return VideoPlaylistElementModel
      .findOne(query)
  }

  // ---------------------------------------------------------------------------

  static listUrlsOfForAP (videoPlaylistId: number, start: number, count: number, t?: Transaction) {
    const getQuery = (forCount: boolean) => {
      return {
        attributes: forCount
          ? []
          : [ 'url' ],
        offset: start,
        limit: count,
        order: getSort('position'),
        where: {
          videoPlaylistId
        },
        transaction: t
      }
    }

    return Promise.all([
      VideoPlaylistElementModel.count(getQuery(true)),
      VideoPlaylistElementModel.findAll(getQuery(false))
    ]).then(([ total, rows ]) => ({
      total,
      data: rows.map(e => e.url)
    }))
  }

  static listElementsForExport (videoPlaylistId: number): Promise<MVideoPlaylistElementVideoUrl[]> {
    return VideoPlaylistElementModel.findAll({
      where: {
        videoPlaylistId
      },
      include: [
        {
          attributes: [ 'url' ],
          model: VideoModel.unscoped(),
          required: true
        }
      ],
      order: getSort('position'),
      limit: USER_EXPORT_MAX_ITEMS
    })
  }

  // ---------------------------------------------------------------------------

  static getNextPositionOf (videoPlaylistId: number, transaction?: Transaction) {
    return getNextPositionOf({
      model: VideoPlaylistElementModel,
      columnName: 'position',
      where: { videoPlaylistId },
      transaction
    })
  }

  static reassignPositionOf (options: {
    videoPlaylistId: number
    firstPosition: number
    endPosition: number
    newPosition: number
    transaction?: Transaction
  }) {
    const { videoPlaylistId, firstPosition, endPosition, newPosition, transaction } = options

    return reassignPositionOf({
      model: VideoPlaylistElementModel,
      columnName: 'position',
      where: { videoPlaylistId },
      transaction,

      firstPosition,
      endPosition,
      newPosition
    })
  }

  static increasePositionOf (options: {
    videoPlaylistId: number
    fromPosition: number
    by: number
    transaction?: Transaction
  }) {
    const { videoPlaylistId, fromPosition, by, transaction } = options

    return increasePositionOf({
      model: VideoPlaylistElementModel,
      columnName: 'position',
      where: { videoPlaylistId },
      transaction,

      fromPosition,
      by
    })
  }

  // ---------------------------------------------------------------------------

  toFormattedJSON (
    this: MVideoPlaylistElementFormattable,
    options: { accountId?: number } = {}
  ): VideoPlaylistElement {
    return {
      id: this.id,
      position: this.position,
      startTimestamp: this.startTimestamp,
      stopTimestamp: this.stopTimestamp,

      type: this.getType(options.accountId),

      video: this.getVideoElement(options.accountId)
    }
  }

  getType (this: MVideoPlaylistElementFormattable, accountId?: number) {
    const video = this.Video

    if (!video) return VideoPlaylistElementType.DELETED

    // Owned video, don't filter it
    if (accountId && video.VideoChannel.Account.id === accountId) return VideoPlaylistElementType.REGULAR

    // Internal video?
    if (video.privacy === VideoPrivacy.INTERNAL && accountId) return VideoPlaylistElementType.REGULAR

    // Private, internal and password protected videos cannot be read without appropriate access (ownership, internal)
    const protectedPrivacy = new Set<VideoPrivacyType>([ VideoPrivacy.PRIVATE, VideoPrivacy.INTERNAL, VideoPrivacy.PASSWORD_PROTECTED ])
    if (protectedPrivacy.has(video.privacy)) {
      return VideoPlaylistElementType.PRIVATE
    }

    if (video.isBlacklisted() || video.isBlocked()) return VideoPlaylistElementType.UNAVAILABLE

    return VideoPlaylistElementType.REGULAR
  }

  getVideoElement (this: MVideoPlaylistElementFormattable, accountId?: number) {
    if (!this.Video) return null
    if (this.getType(accountId) !== VideoPlaylistElementType.REGULAR) return null

    return this.Video.toFormattedJSON()
  }

  toActivityPubObject (this: MVideoPlaylistElementAP): PlaylistElementObject {
    const base: PlaylistElementObject = {
      id: this.url,
      type: 'PlaylistElement',

      url: this.Video?.url || null,
      position: this.position
    }

    if (this.startTimestamp) base.startTimestamp = this.startTimestamp
    if (this.stopTimestamp) base.stopTimestamp = this.stopTimestamp

    return base
  }
}
