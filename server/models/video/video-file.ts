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
import { FindOptions, Op, QueryTypes, Transaction } from 'sequelize'
import { MIMETYPES } from '../../initializers/constants'
import { MVideoFile, MVideoFileStreamingPlaylistVideo, MVideoFileVideo } from '../../typings/models/video/video-file'
import { MStreamingPlaylistVideo, MVideo } from '@server/typings/models'

@Table({
  tableName: 'videoFile',
  indexes: [
    {
      fields: [ 'videoId' ],
      where: {
        videoId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'videoStreamingPlaylistId' ],
      where: {
        videoStreamingPlaylistId: {
          [Op.ne]: null
        }
      }
    },

    {
      fields: [ 'infoHash' ]
    },

    {
      fields: [ 'videoId', 'resolution', 'fps' ],
      unique: true,
      where: {
        videoId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'videoStreamingPlaylistId', 'resolution', 'fps' ],
      unique: true,
      where: {
        videoStreamingPlaylistId: {
          [Op.ne]: null
        }
      }
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
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  Video: VideoModel

  @ForeignKey(() => VideoStreamingPlaylistModel)
  @Column
  videoStreamingPlaylistId: number

  @BelongsTo(() => VideoStreamingPlaylistModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  VideoStreamingPlaylist: VideoStreamingPlaylistModel

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
      type: QueryTypes.SELECT as QueryTypes.SELECT,
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

  // Redefine upsert because sequelize does not use an appropriate where clause in the update query with 2 unique indexes
  static async customUpsert (
    videoFile: MVideoFile,
    mode: 'streaming-playlist' | 'video',
    transaction: Transaction
  ) {
    const baseWhere = {
      fps: videoFile.fps,
      resolution: videoFile.resolution
    }

    if (mode === 'streaming-playlist') Object.assign(baseWhere, { videoStreamingPlaylistId: videoFile.videoStreamingPlaylistId })
    else Object.assign(baseWhere, { videoId: videoFile.videoId })

    const element = await VideoFileModel.findOne({ where: baseWhere, transaction })
    if (!element) return videoFile.save({ transaction })

    for (const k of Object.keys(videoFile.toJSON())) {
      element[k] = videoFile[k]
    }

    return element.save({ transaction })
  }

  getVideoOrStreamingPlaylist (this: MVideoFileVideo | MVideoFileStreamingPlaylistVideo): MVideo | MStreamingPlaylistVideo {
    if (this.videoId) return (this as MVideoFileVideo).Video

    return (this as MVideoFileStreamingPlaylistVideo).VideoStreamingPlaylist
  }

  isAudio () {
    return !!MIMETYPES.AUDIO.EXT_MIMETYPE[this.extname]
  }

  hasSameUniqueKeysThan (other: MVideoFile) {
    return this.fps === other.fps &&
      this.resolution === other.resolution &&
      (
        (this.videoId !== null && this.videoId === other.videoId) ||
        (this.videoStreamingPlaylistId !== null && this.videoStreamingPlaylistId === other.videoStreamingPlaylistId)
      )
  }
}
