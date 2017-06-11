import * as Sequelize from 'sequelize'

import { addMethodsToModel } from './utils'
import {
  ApplicationClass,
  ApplicationAttributes,
  ApplicationInstance,

  ApplicationMethods
} from './application-interface'

let Application: Sequelize.Model<ApplicationInstance, ApplicationAttributes>
let loadMigrationVersion: ApplicationMethods.LoadMigrationVersion
let updateMigrationVersion: ApplicationMethods.UpdateMigrationVersion

export default function defineApplication (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  Application = sequelize.define<ApplicationInstance, ApplicationAttributes>('Application',
    {
      migrationVersion: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
        validate: {
          isInt: true
        }
      }
    }
  )

  const classMethods = [ loadMigrationVersion, updateMigrationVersion ]
  addMethodsToModel(Application, classMethods)

  return Application
}

// ---------------------------------------------------------------------------

loadMigrationVersion = function (callback: ApplicationMethods.LoadMigrationVersionCallback) {
  const query = {
    attributes: [ 'migrationVersion' ]
  }

  return Application.findOne(query).asCallback(function (err, data) {
    const version = data ? data.migrationVersion : null

    return callback(err, version)
  })
}

updateMigrationVersion = function (newVersion: number, transaction: Sequelize.Transaction, callback: ApplicationMethods.UpdateMigrationVersionCallback) {
  const options: Sequelize.UpdateOptions = {
    where: {},
    transaction: transaction
  }

  return Application.update({ migrationVersion: newVersion }, options).asCallback(callback)
}
