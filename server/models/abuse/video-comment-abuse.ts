import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoComment } from '@shared/models'
import { VideoCommentModel } from '../video/video-comment'
import { AbuseModel } from './abuse'

@Table({
  tableName: 'commentAbuse',
  indexes: [
    {
      fields: [ 'abuseId' ]
    },
    {
      fields: [ 'videoCommentId' ]
    }
  ]
})
export class VideoCommentAbuseModel extends Model<VideoCommentAbuseModel> {

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(true)
  @Default(null)
  @Column(DataType.JSONB)
  deletedComment: VideoComment

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

  @ForeignKey(() => VideoCommentModel)
  @Column
  videoCommentId: number

  @BelongsTo(() => VideoCommentModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  VideoComment: VideoCommentModel
}
