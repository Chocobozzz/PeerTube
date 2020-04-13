import { Column, CreatedAt, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { AbuseReasonModel } from './abuse-reason'
import { VideoAbuseModel } from './video-abuse'

@Table({
  tableName: 'videoAbuseReason',
  indexes: [
    {
      fields: [ 'videoAbuseId' ]
    },
    {
      fields: [ 'abuseReasonId' ]
    }
  ]
})
export class VideoAbuseReasonModel extends Model<VideoAbuseReasonModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => VideoAbuseModel)
  @Column
  videoAbuseId: number

  @ForeignKey(() => AbuseReasonModel)
  @Column
  abuseReasonId: number
}
