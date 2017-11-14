import * as Sequelize from 'sequelize'
import * as Bluebird from 'bluebird'

export namespace ApplicationMethods {
  export type LoadMigrationVersion = () => Bluebird<number>

  export type UpdateMigrationVersion = (
    newVersion: number,
    transaction: Sequelize.Transaction
  ) => Bluebird<[ number, ApplicationInstance[] ]>

  export type CountTotal = () => Bluebird<number>
}

export interface ApplicationClass {
  loadMigrationVersion: ApplicationMethods.LoadMigrationVersion
  updateMigrationVersion: ApplicationMethods.UpdateMigrationVersion
  countTotal: ApplicationMethods.CountTotal
}

export interface ApplicationAttributes {
  migrationVersion: number
}

export interface ApplicationInstance extends ApplicationClass, ApplicationAttributes, Sequelize.Instance<ApplicationAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface ApplicationModel extends ApplicationClass, Sequelize.Model<ApplicationInstance, ApplicationAttributes> {}
