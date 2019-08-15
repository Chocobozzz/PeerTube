import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Is,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import {
  isVideoFileExtnameValid,
  isVideoFileInfoHashValid,
  isVideoFileResolutionValid,
  isVideoFileSizeValid,
  isVideoFPSResolutionValid
} from '../../helpers/custom-validators/videos'
import { parseAggregateResult, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { VideoRedundancyModel } from '../redundancy/video-redundancy'
import { VideoStreamingPlaylistModel } from './video-streaming-playlist'
import { FindOptions, QueryTypes, Transaction } from 'sequelize'
import { MIMETYPES } from '../../initializers/constants'
import { MVideoFile } from '@server/typings/models'

@Table({
  tableName: 'videoFile',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'infoHash' ]
    },
    {
      fields: [ 'videoId', 'resolution', 'fps' ],
      unique: true
    }
  ]
})
export class VideoFileModel extends Model<VideoFileModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Is('VideoFileResolution', value => throwIfNotValid(value, isVideoFileResolutionValid, 'resolution'))
  @Column
  resolution: number

  @AllowNull(false)
  @Is('VideoFileSize', value => throwIfNotValid(value, isVideoFileSizeValid, 'size'))
  @Column(DataType.BIGINT)
  size: number

  @AllowNull(false)
  @Is('VideoFileExtname', value => throwIfNotValid(value, isVideoFileExtnameValid, 'extname'))
  @Column
  extname: string

  @AllowNull(false)
  @Is('VideoFileInfohash', value => throwIfNotValid(value, isVideoFileInfoHashValid, 'info hash'))
  @Column
  infoHash: string

  @AllowNull(false)
  @Default(-1)
  @Is('VideoFileFPS', value => throwIfNotValid(value, isVideoFPSResolutionValid, 'fps'))
  @Column
  fps: number

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

  @HasMany(() => VideoRedundancyModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  RedundancyVideos: VideoRedundancyModel[]

  static doesInfohashExist (infoHash: string) {
    const query = 'SELECT 1 FROM "videoFile" WHERE "infoHash" = $infoHash LIMIT 1'
    const options = {
      type: QueryTypes.SELECT,
      bind: { infoHash },
      raw: true
    }

    return VideoModel.sequelize.query(query, options)
              .then(results => results.length === 1)
  }

  static loadWithVideo (id: number) {
    const options = {
      include: [
        {
          model: VideoModel.unscoped(),
          required: true
        }
      ]
    }

    return VideoFileModel.findByPk(id, options)
  }

  static listByStreamingPlaylist (streamingPlaylistId: number, transaction: Transaction) {
    const query = {
      include: [
        {
          model: VideoModel.unscoped(),
          required: true,
          include: [
            {
              model: VideoStreamingPlaylistModel.unscoped(),
              required: true,
              where: {
                id: streamingPlaylistId
              }
            }
          ]
        }
      ],
      transaction
    }

    return VideoFileModel.findAll(query)
  }

  static getStats () {
    const query: FindOptions = {
      include: [
        {
          attributes: [],
          model: VideoModel.unscoped(),
          where: {
            remote: false
          }
        }
      ]
    }

    return VideoFileModel.aggregate('size', 'SUM', query)
      .then(result => ({
        totalLocalVideoFilesSize: parseAggregateResult(result)
      }))
  }

  isAudio () {
    return !!MIMETYPES.AUDIO.EXT_MIMETYPE[this.extname]
  }

  hasSameUniqueKeysThan (other: MVideoFile) {
    return this.fps === other.fps &&
      this.resolution === other.resolution &&
      this.videoId === other.videoId
  }
}
