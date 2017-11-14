import * as Sequelize from 'sequelize'

import { addMethodsToModel } from '../utils'
import {
  ApplicationAttributes,
  ApplicationInstance,

  ApplicationMethods
} from './application-interface'

let Application: Sequelize.Model<ApplicationInstance, ApplicationAttributes>
let loadMigrationVersion: ApplicationMethods.LoadMigrationVersion
let updateMigrationVersion: ApplicationMethods.UpdateMigrationVersion
let countTotal: ApplicationMethods.CountTotal

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

  const classMethods = [
    countTotal,
    loadMigrationVersion,
    updateMigrationVersion
  ]
  addMethodsToModel(Application, classMethods)

  return Application
}

// ---------------------------------------------------------------------------

countTotal = function () {
  return this.count()
}

loadMigrationVersion = function () {
  const query = {
    attributes: [ 'migrationVersion' ]
  }

  return Application.findOne(query).then(data => data ? data.migrationVersion : null)
}

updateMigrationVersion = function (newVersion: number, transaction: Sequelize.Transaction) {
  const options: Sequelize.UpdateOptions = {
    where: {},
    transaction: transaction
  }

  return Application.update({ migrationVersion: newVersion }, options)
}
