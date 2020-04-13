import { AllowNull, BelongsToMany, Column, Model, Table } from 'sequelize-typescript'
import { VideoAbuseModel } from './video-abuse'
import { VideoAbuseReasonModel } from './video-abuse-reason'

@Table({
  tableName: 'abuseReason',
  timestamps: false,
  indexes: [
    {
      fields: [ 'predefinedReasonId' ],
      unique: true
    }
  ]
})
export class AbuseReasonModel extends Model<AbuseReasonModel> {

  @AllowNull(false)
  @Column
  predefinedReasonId: number

  @BelongsToMany(() => VideoAbuseModel, {
    foreignKey: 'abuseReasonId',
    through: () => VideoAbuseReasonModel,
    onDelete: 'CASCADE'
  })
  Abuses: VideoAbuseModel[]
}
