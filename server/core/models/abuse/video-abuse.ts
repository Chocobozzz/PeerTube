import { type VideoDetails } from '@peertube/peertube-models'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoModel } from '../video/video.js'
import { AbuseModel } from './abuse.js'

@Table({
  tableName: 'videoAbuse',
  indexes: [
    {
      fields: [ 'abuseId' ]
    },
    {
      fields: [ 'videoId' ]
    }
  ]
})
export class VideoAbuseModel extends Model<Partial<AttributesOnly<VideoAbuseModel>>> {

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(true)
  @Default(null)
  @Column
  startAt: number

  @AllowNull(true)
  @Default(null)
  @Column
  endAt: number

  @AllowNull(true)
  @Default(null)
  @Column(DataType.JSONB)
  deletedVideo: VideoDetails

  @ForeignKey(() => AbuseModel)
  @Column
  abuseId: number

  @BelongsTo(() => AbuseModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Abuse: Awaited<AbuseModel>

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  Video: Awaited<VideoModel>
}
