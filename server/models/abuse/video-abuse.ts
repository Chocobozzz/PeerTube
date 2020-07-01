import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoDetails } from '@shared/models'
import { VideoModel } from '../video/video'
import { AbuseModel } from './abuse'

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
export class VideoAbuseModel extends Model<VideoAbuseModel> {

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
  Abuse: AbuseModel

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
}
