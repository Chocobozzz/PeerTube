import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

export namespace ApplicationMethods {
  export type LoadMigrationVersion = () => Promise<number>

  export type UpdateMigrationVersion = (
    newVersion: number,
    transaction: Sequelize.Transaction
  ) => Promise<[ number, ApplicationInstance[] ]>
}

export interface ApplicationClass {
  loadMigrationVersion: ApplicationMethods.LoadMigrationVersion
  updateMigrationVersion: ApplicationMethods.UpdateMigrationVersion
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
