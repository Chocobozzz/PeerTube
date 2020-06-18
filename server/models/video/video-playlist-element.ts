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
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { ForAPIOptions, ScopeNames as VideoScopeNames, VideoModel } from './video'
import { VideoPlaylistModel } from './video-playlist'
import { getSort, throwIfNotValid } from '../utils'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { PlaylistElementObject } from '../../../shared/models/activitypub/objects/playlist-element-object'
import validator from 'validator'
import { AggregateOptions, Op, ScopeOptions, Sequelize, Transaction } from 'sequelize'
import { VideoPlaylistElement, VideoPlaylistElementType } from '../../../shared/models/videos/playlist/video-playlist-element.model'
import { AccountModel } from '../account/account'
import { VideoPrivacy } from '../../../shared/models/videos'
import * as Bluebird from 'bluebird'
import {
  MVideoPlaylistElement,
  MVideoPlaylistElementAP,
  MVideoPlaylistElementFormattable,
  MVideoPlaylistElementVideoUrlPlaylistPrivacy,
  MVideoPlaylistVideoThumbnail
} from '@server/types/models/video/video-playlist-element'
import { MUserAccountId } from '@server/types/models'

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
      fields: [ 'videoPlaylistId', 'videoId' ],
      unique: true
    },
    {
      fields: [ 'url' ],
      unique: true
    }
  ]
})
export class VideoPlaylistElementModel extends Model<VideoPlaylistElementModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Is('VideoPlaylistUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_PLAYLISTS.URL.max))
  url: string

  @AllowNull(false)
  @Default(1)
  @IsInt
  @Min(1)
  @Column
  position: number

  @AllowNull(true)
  @IsInt
  @Min(0)
  @Column
  startTimestamp: number

  @AllowNull(true)
  @IsInt
  @Min(0)
  @Column
  stopTimestamp: number

  @ForeignKey(() => VideoPlaylistModel)
  @Column
  videoPlaylistId: number

  @BelongsTo(() => VideoPlaylistModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  VideoPlaylist: VideoPlaylistModel

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  Video: VideoModel

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
        VideoScopeNames.FOR_API, forApiOptions
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

  static loadByPlaylistAndVideo (videoPlaylistId: number, videoId: number): Bluebird<MVideoPlaylistElement> {
    const query = {
      where: {
        videoPlaylistId,
        videoId
      }
    }

    return VideoPlaylistElementModel.findOne(query)
  }

  static loadById (playlistElementId: number | string): Bluebird<MVideoPlaylistElement> {
    return VideoPlaylistElementModel.findByPk(playlistElementId)
  }

  static loadByPlaylistAndVideoForAP (
    playlistId: number | string,
    videoId: number | string
  ): Bluebird<MVideoPlaylistElementVideoUrlPlaylistPrivacy> {
    const playlistWhere = validator.isUUID('' + playlistId) ? { uuid: playlistId } : { id: playlistId }
    const videoWhere = validator.isUUID('' + videoId) ? { uuid: videoId } : { id: videoId }

    const query = {
      include: [
        {
          attributes: [ 'privacy' ],
          model: VideoPlaylistModel.unscoped(),
          where: playlistWhere
        },
        {
          attributes: [ 'url' ],
          model: VideoModel.unscoped(),
          where: videoWhere
        }
      ]
    }

    return VideoPlaylistElementModel.findOne(query)
  }

  static listUrlsOfForAP (videoPlaylistId: number, start: number, count: number, t?: Transaction) {
    const query = {
      attributes: [ 'url' ],
      offset: start,
      limit: count,
      order: getSort('position'),
      where: {
        videoPlaylistId
      },
      transaction: t
    }

    return VideoPlaylistElementModel
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows.map(e => e.url) }
      })
  }

  static loadFirstElementWithVideoThumbnail (videoPlaylistId: number): Bluebird<MVideoPlaylistVideoThumbnail> {
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

  static getNextPositionOf (videoPlaylistId: number, transaction?: Transaction) {
    const query: AggregateOptions<number> = {
      where: {
        videoPlaylistId
      },
      transaction
    }

    return VideoPlaylistElementModel.max('position', query)
      .then(position => position ? position + 1 : 1)
  }

  static reassignPositionOf (
    videoPlaylistId: number,
    firstPosition: number,
    endPosition: number,
    newPosition: number,
    transaction?: Transaction
  ) {
    const query = {
      where: {
        videoPlaylistId,
        position: {
          [Op.gte]: firstPosition,
          [Op.lte]: endPosition
        }
      },
      transaction,
      validate: false // We use a literal to update the position
    }

    return VideoPlaylistElementModel.update({ position: Sequelize.literal(`${newPosition} + "position" - ${firstPosition}`) }, query)
  }

  static increasePositionOf (
    videoPlaylistId: number,
    fromPosition: number,
    toPosition?: number,
    by = 1,
    transaction?: Transaction
  ) {
    const query = {
      where: {
        videoPlaylistId,
        position: {
          [Op.gte]: fromPosition
        }
      },
      transaction
    }

    return VideoPlaylistElementModel.increment({ position: by }, query)
  }

  getType (this: MVideoPlaylistElementFormattable, displayNSFW?: boolean, accountId?: number) {
    const video = this.Video

    if (!video) return VideoPlaylistElementType.DELETED

    // Owned video, don't filter it
    if (accountId && video.VideoChannel.Account.id === accountId) return VideoPlaylistElementType.REGULAR

    // Internal video?
    if (video.privacy === VideoPrivacy.INTERNAL && accountId) return VideoPlaylistElementType.REGULAR

    if (video.privacy === VideoPrivacy.PRIVATE || video.privacy === VideoPrivacy.INTERNAL) return VideoPlaylistElementType.PRIVATE

    if (video.isBlacklisted() || video.isBlocked()) return VideoPlaylistElementType.UNAVAILABLE
    if (video.nsfw === true && displayNSFW === false) return VideoPlaylistElementType.UNAVAILABLE

    return VideoPlaylistElementType.REGULAR
  }

  getVideoElement (this: MVideoPlaylistElementFormattable, displayNSFW?: boolean, accountId?: number) {
    if (!this.Video) return null
    if (this.getType(displayNSFW, accountId) !== VideoPlaylistElementType.REGULAR) return null

    return this.Video.toFormattedJSON()
  }

  toFormattedJSON (
    this: MVideoPlaylistElementFormattable,
    options: { displayNSFW?: boolean, accountId?: number } = {}
  ): VideoPlaylistElement {
    return {
      id: this.id,
      position: this.position,
      startTimestamp: this.startTimestamp,
      stopTimestamp: this.stopTimestamp,

      type: this.getType(options.displayNSFW, options.accountId),

      video: this.getVideoElement(options.displayNSFW, options.accountId)
    }
  }

  toActivityPubObject (this: MVideoPlaylistElementAP): PlaylistElementObject {
    const base: PlaylistElementObject = {
      id: this.url,
      type: 'PlaylistElement',

      url: this.Video.url,
      position: this.position
    }

    if (this.startTimestamp) base.startTimestamp = this.startTimestamp
    if (this.stopTimestamp) base.stopTimestamp = this.stopTimestamp

    return base
  }
}
