import { Transaction } from 'sequelize'
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

  static loadMigrationVersion () {
    const query = {
      attributes: [ 'migrationVersion' ]
    }

    return ApplicationModel.findOne(query).then(data => data ? data.migrationVersion : null)
  }

  static updateMigrationVersion (newVersion: number, transaction: Transaction) {
    const options = {
      where: {},
      transaction: transaction
    }

    return ApplicationModel.update({ migrationVersion: newVersion }, options)
  }
}
