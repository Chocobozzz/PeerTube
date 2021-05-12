import { BelongsTo, Column, CreatedAt, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { AttributesOnly } from '@shared/core-utils'
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
export class VideoCommentAbuseModel extends Model<Partial<AttributesOnly<VideoCommentAbuseModel>>> {

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

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
