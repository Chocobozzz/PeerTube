import type { FileStorageType, VideoSource } from '@peertube/peertube-models'
import { STATIC_DOWNLOAD_PATHS, WEBSERVER } from '@server/initializers/constants.js'
import { join } from 'path'
import { Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { SequelizeModel, getSort } from '../shared/index.js'
import { getResolutionLabel } from './formatter/video-api-format.js'
import { VideoModel } from './video.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'

@Table({
  tableName: 'videoSource',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ { name: 'createdAt', order: 'DESC' } ]
    },
    {
      fields: [ 'keptOriginalFilename' ],
      unique: true
    }
  ]
})
export class VideoSourceModel extends SequelizeModel<VideoSourceModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Column
  inputFilename: string

  @AllowNull(true)
  @Column
  keptOriginalFilename: string

  @AllowNull(true)
  @Column
  resolution: number

  @AllowNull(true)
  @Column
  width: number

  @AllowNull(true)
  @Column
  height: number

  @AllowNull(true)
  @Column
  fps: number

  @AllowNull(true)
  @Column(DataType.BIGINT)
  size: number

  @AllowNull(true)
  @Column(DataType.JSONB)
  metadata: any

  @AllowNull(true)
  @Column
  storage: FileStorageType

  @AllowNull(true)
  @Column
  fileUrl: string

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Video: Awaited<VideoModel>

  static loadLatest (videoId: number, transaction?: Transaction) {
    return VideoSourceModel.findOne<MVideoSource>({
      where: { videoId },
      order: getSort('-createdAt'),
      transaction
    })
  }

  static loadByKeptOriginalFilename (keptOriginalFilename: string) {
    return VideoSourceModel.findOne<MVideoSource>({
      where: { keptOriginalFilename }
    })
  }

  static listAll (videoId: number, transaction?: Transaction) {
    return VideoSourceModel.findAll<MVideoSource>({
      where: { videoId },
      transaction
    })
  }

  getFileDownloadUrl () {
    if (!this.keptOriginalFilename) return null

    return WEBSERVER.URL + join(STATIC_DOWNLOAD_PATHS.ORIGINAL_VIDEO_FILE, this.keptOriginalFilename)
  }

  toFormattedJSON (): VideoSource {
    return {
      filename: this.inputFilename,
      inputFilename: this.inputFilename,
      fileDownloadUrl: this.getFileDownloadUrl(),

      resolution: {
        id: this.resolution,
        label: this.resolution !== null
          ? getResolutionLabel(this.resolution)
          : null
      },
      size: this.size,

      width: this.width,
      height: this.height,

      fps: this.fps,

      metadata: this.metadata,

      createdAt: this.createdAt.toISOString()
    }
  }
}
