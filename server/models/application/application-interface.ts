import * as Sequelize from 'sequelize'

export namespace ApplicationMethods {
  export type LoadMigrationVersionCallback = (err: Error, version: number) => void
  export type LoadMigrationVersion = (callback: LoadMigrationVersionCallback) => void

  export type UpdateMigrationVersionCallback = (err: Error, applicationInstance: ApplicationAttributes) => void
  export type UpdateMigrationVersion = (newVersion: number, transaction: Sequelize.Transaction, callback: UpdateMigrationVersionCallback) => void
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
