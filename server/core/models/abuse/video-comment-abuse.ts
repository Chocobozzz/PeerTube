import { BelongsTo, Column, CreatedAt, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoCommentModel } from '../video/video-comment.js'
import { AbuseModel } from './abuse.js'
import { SequelizeModel } from '../shared/index.js'

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
export class VideoCommentAbuseModel extends SequelizeModel<VideoCommentAbuseModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

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

  @ForeignKey(() => VideoCommentModel)
  @Column
  declare videoCommentId: number

  @BelongsTo(() => VideoCommentModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'set null'
  })
  declare VideoComment: Awaited<VideoCommentModel>
}
