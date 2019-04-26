import { AllowNull, Column, Default, DefaultScope, HasOne, IsInt, Model, Table } from 'sequelize-typescript'
import { AccountModel } from '../account/account'

@DefaultScope(() => ({
  include: [
    {
      model: AccountModel,
      required: true
    }
  ]
}))
@Table({
  tableName: 'application',
  timestamps: false
})
export class ApplicationModel extends Model<ApplicationModel> {

  @AllowNull(false)
  @Default(0)
  @IsInt
  @Column
  migrationVersion: number

  @HasOne(() => AccountModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  Account: AccountModel

  static countTotal () {
    return ApplicationModel.count()
  }

  static load () {
    return ApplicationModel.findOne()
  }
}
