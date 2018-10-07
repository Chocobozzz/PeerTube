import { values } from 'lodash'
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
  isVideoFileInfoHashValid,
  isVideoFileResolutionValid,
  isVideoFileSizeValid,
  isVideoFPSResolutionValid
} from '../../helpers/custom-validators/videos'
import { CONSTRAINTS_FIELDS } from '../../initializers'
import { throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import * as Sequelize from 'sequelize'
import { VideoRedundancyModel } from '../redundancy/video-redundancy'

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
  @Column(DataType.ENUM(values(CONSTRAINTS_FIELDS.VIDEOS.EXTNAME)))
  extname: string

  @AllowNull(false)
  @Is('VideoFileSize', value => throwIfNotValid(value, isVideoFileInfoHashValid, 'info hash'))
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
      allowNull: false
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  RedundancyVideos: VideoRedundancyModel[]

  static isInfohashExists (infoHash: string) {
    const query = 'SELECT 1 FROM "videoFile" WHERE "infoHash" = $infoHash LIMIT 1'
    const options = {
      type: Sequelize.QueryTypes.SELECT,
      bind: { infoHash },
      raw: true
    }

    return VideoModel.sequelize.query(query, options)
              .then(results => {
                return results.length === 1
              })
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

    return VideoFileModel.findById(id, options)
  }

  hasSameUniqueKeysThan (other: VideoFileModel) {
    return this.fps === other.fps &&
      this.resolution === other.resolution &&
      this.videoId === other.videoId
  }
}
