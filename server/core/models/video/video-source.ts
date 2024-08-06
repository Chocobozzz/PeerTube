import { getResolutionLabel } from '@peertube/peertube-core-utils'
import { ActivityVideoUrlObject, type FileStorageType, type VideoSource } from '@peertube/peertube-models'
import { DOWNLOAD_PATHS, WEBSERVER } from '@server/initializers/constants.js'
import { getVideoFileMimeType } from '@server/lib/video-file.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'
import { extname, join } from 'path'
import { Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { SequelizeModel, doesExist, getSort } from '../shared/index.js'
import { VideoModel } from './video.js'

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

  // ---------------------------------------------------------------------------

  static async doesOwnedFileExist (filename: string, storage: FileStorageType) {
    const query = 'SELECT 1 FROM "videoSource" ' +
      'INNER JOIN "video" ON "video"."id" = "videoSource"."videoId" AND "video"."remote" IS FALSE ' +
      `WHERE "keptOriginalFilename" = $filename AND "storage" = $storage LIMIT 1`

    return doesExist({ sequelize: this.sequelize, query, bind: { filename, storage } })
  }

  // ---------------------------------------------------------------------------

  getFileDownloadUrl () {
    if (!this.keptOriginalFilename) return null

    return WEBSERVER.URL + join(DOWNLOAD_PATHS.ORIGINAL_VIDEO_FILE, this.keptOriginalFilename)
  }

  toActivityPubObject (this: MVideoSource): ActivityVideoUrlObject {
    const mimeType = getVideoFileMimeType(extname(this.inputFilename), false)

    return {
      type: 'Link',
      mediaType: mimeType as ActivityVideoUrlObject['mediaType'],
      href: null,
      height: this.height || this.resolution,
      width: this.width,
      size: this.size,
      fps: this.fps,
      attachment: []
    }
  }

  toFormattedJSON (this: MVideoSource): VideoSource {
    return {
      filename: this.inputFilename,
      inputFilename: this.inputFilename,

      fileUrl: this.fileUrl,
      fileDownloadUrl: this.getFileDownloadUrl(),

      resolution: {
        id: this.resolution,
        label: this.resolution !== null
          ? getResolutionLabel({ resolution: this.resolution, height: this.height, width: this.width })
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
