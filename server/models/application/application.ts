import { AllowNull, Column, Default, IsInt, Model, Table } from 'sequelize-typescript'

@Table({
  tableName: 'application'
})
export class ApplicationModel extends Model<ApplicationModel> {

  @AllowNull(false)
  @Default(0)
  @IsInt
  @Column
  migrationVersion: number

  static countTotal () {
    return ApplicationModel.count()
  }
}
