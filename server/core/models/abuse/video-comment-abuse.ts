import { BelongsTo, Column, CreatedAt, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { VideoCommentModel } from '../video/video-comment.js'
import { AbuseModel } from './abuse.js'

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
  Abuse: Awaited<AbuseModel>

  @ForeignKey(() => VideoCommentModel)
  @Column
  videoCommentId: number

  @BelongsTo(() => VideoCommentModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  VideoComment: Awaited<VideoCommentModel>
}
