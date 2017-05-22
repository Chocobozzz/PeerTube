import * as Sequelize from 'sequelize'

export namespace ApplicationMethods {
  export type LoadMigrationVersion = (callback: (err: Error, version: number) => void) => void
  export type UpdateMigrationVersion = (newVersion: number, transaction: any, callback: any) => void
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
