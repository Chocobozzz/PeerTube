import { values } from 'lodash'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
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

  @AllowNull(true)
  @Default(null)
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
}
