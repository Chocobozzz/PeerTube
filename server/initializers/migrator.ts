import * as path from 'path'
import * as Promise from 'bluebird'

import { database as db } from './database'
import { LAST_MIGRATION_VERSION } from './constants'
import { logger, readdirPromise } from '../helpers'

function migrate () {
  const p = db.sequelize.getQueryInterface().showAllTables()
    .then(tables => {
      // No tables, we don't need to migrate anything
      // The installer will do that
      if (tables.length === 0) throw null
    })
    .then(() => {
      return db.Application.loadMigrationVersion()
    })
    .then(actualVersion => {
      if (actualVersion === null) {
        return db.Application.create({ migrationVersion: 0 }).then(() => 0)
      }

      return actualVersion
    })
    .then(actualVersion => {
      // No need migrations, abort
      if (actualVersion >= LAST_MIGRATION_VERSION) throw null

      return actualVersion
    })
    .then(actualVersion => {
      // If there are a new migration scripts
      logger.info('Begin migrations.')

      return getMigrationScripts().then(migrationScripts => ({ actualVersion, migrationScripts }))
    })
    .then(({ actualVersion, migrationScripts }) => {
      return Promise.each(migrationScripts, entity => executeMigration(actualVersion, entity))
    })
    .then(() => {
      logger.info('Migrations finished. New migration version schema: %s', LAST_MIGRATION_VERSION)
    })
    .catch(err => {
      if (err === null) return undefined

      throw err
    })

  return p
}

// ---------------------------------------------------------------------------

export {
  migrate
}

// ---------------------------------------------------------------------------

function getMigrationScripts () {
  return readdirPromise(path.join(__dirname, 'migrations')).then(files => {
    const filesToMigrate: {
      version: string,
      script: string
    }[] = []

    files.forEach(function (file) {
      // Filename is something like 'version-blabla.js'
      const version = file.split('-')[0]
      filesToMigrate.push({
        version,
        script: file
      })
    })

    return filesToMigrate
  })
}

function executeMigration (actualVersion: number, entity: { version: string, script: string }) {
  const versionScript = parseInt(entity.version, 10)

  // Do not execute old migration scripts
  if (versionScript <= actualVersion) return undefined

  // Load the migration module and run it
  const migrationScriptName = entity.script
  logger.info('Executing %s migration script.', migrationScriptName)

  const migrationScript = require(path.join(__dirname, 'migrations', migrationScriptName))

  return db.sequelize.transaction(t => {
    const options = {
      transaction: t,
      queryInterface: db.sequelize.getQueryInterface(),
      sequelize: db.sequelize
    }

    return migrationScript.up(options)
      .then(() => {
        // Update the new migration version
        return db.Application.updateMigrationVersion(versionScript, t)
      })
  })
}
