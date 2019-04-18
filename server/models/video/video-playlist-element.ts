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
import { VideoModel } from './video'
import { VideoPlaylistModel } from './video-playlist'
import { getSort, throwIfNotValid } from '../utils'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'
import { PlaylistElementObject } from '../../../shared/models/activitypub/objects/playlist-element-object'
import * as validator from 'validator'
import { AggregateOptions, Op, Sequelize, Transaction } from 'sequelize'

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
      allowNull: false
    },
    onDelete: 'CASCADE'
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

  static loadByPlaylistAndVideo (videoPlaylistId: number, videoId: number) {
    const query = {
      where: {
        videoPlaylistId,
        videoId
      }
    }

    return VideoPlaylistElementModel.findOne(query)
  }

  static loadByPlaylistAndVideoForAP (playlistId: number | string, videoId: number | string) {
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

  toActivityPubObject (): PlaylistElementObject {
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
