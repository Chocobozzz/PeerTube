import { AllowNull, Column, CreatedAt, Model, Table, UpdatedAt } from 'sequelize-typescript'

@Table({
  tableName: 'avatar'
})
export class AvatarModel extends Model<AvatarModel> {

  @AllowNull(false)
  @Column
  filename: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date
}
