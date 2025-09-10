import { type VideoDetails } from '@peertube/peertube-models'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoModel } from '../video/video.js'
import { AbuseModel } from './abuse.js'
import { SequelizeModel } from '../shared/index.js'

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
export class VideoAbuseModel extends SequelizeModel<VideoAbuseModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(true)
  @Default(null)
  @Column
  declare startAt: number

  @AllowNull(true)
  @Default(null)
  @Column
  declare endAt: number

  @AllowNull(true)
  @Default(null)
  @Column(DataType.JSONB)
  declare deletedVideo: VideoDetails

  @ForeignKey(() => AbuseModel)
  @Column
  declare abuseId: number

  @BelongsTo(() => AbuseModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare Abuse: Awaited<AbuseModel>

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  declare Video: Awaited<VideoModel>
}
