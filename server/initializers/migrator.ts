import { waterfall, eachSeries } from 'async'
import * as fs from 'fs'
import * as path from 'path'
import * as Sequelize from 'sequelize'

import { database as db } from './database'
import { LAST_MIGRATION_VERSION } from './constants'
import { logger } from '../helpers'
import { ApplicationInstance } from '../models'

function migrate (finalCallback: (err: Error) => void) {
  waterfall([

    function checkApplicationTableExists (callback) {
      db.sequelize.getQueryInterface().showAllTables().asCallback(function (err, tables) {
        if (err) return callback(err)

        // No tables, we don't need to migrate anything
        // The installer will do that
        if (tables.length === 0) return finalCallback(null)

        return callback(null)
      })
    },

    function loadMigrationVersion (callback) {
      db.Application.loadMigrationVersion(callback)
    },

    function createMigrationRowIfNotExists (actualVersion, callback) {
      if (actualVersion === null) {
        db.Application.create({
          migrationVersion: 0
        }, function (err) {
          return callback(err, 0)
        })
      }

      return callback(null, actualVersion)
    },

    function abortMigrationIfNotNeeded (actualVersion, callback) {
      // No need migrations
      if (actualVersion >= LAST_MIGRATION_VERSION) return finalCallback(null)

      return callback(null, actualVersion)
    },

    function getMigrations (actualVersion, callback) {
      // If there are a new migration scripts
      logger.info('Begin migrations.')

      getMigrationScripts(function (err, migrationScripts) {
        return callback(err, actualVersion, migrationScripts)
      })
    },

    function doMigrations (actualVersion, migrationScripts, callback) {
      eachSeries(migrationScripts, function (entity: any, callbackEach) {
        executeMigration(actualVersion, entity, callbackEach)
      }, function (err) {
        if (err) return callback(err)

        logger.info('Migrations finished. New migration version schema: %s', LAST_MIGRATION_VERSION)
        return callback(null)
      })
    }
  ], finalCallback)
}

// ---------------------------------------------------------------------------

export {
  migrate
}

// ---------------------------------------------------------------------------

type GetMigrationScriptsCallback = (err: Error, filesToMigrate?: { version: string, script: string }[]) => void
function getMigrationScripts (callback: GetMigrationScriptsCallback) {
  fs.readdir(path.join(__dirname, 'migrations'), function (err, files) {
    if (err) return callback(err)

    const filesToMigrate = []

    files.forEach(function (file) {
      // Filename is something like 'version-blabla.js'
      const version = file.split('-')[0]
      filesToMigrate.push({
        version,
        script: file
      })
    })

    return callback(err, filesToMigrate)
  })
}

function executeMigration (actualVersion: number, entity: { version: string, script: string }, callback: (err: Error) => void) {
  const versionScript = parseInt(entity.version, 10)

  // Do not execute old migration scripts
  if (versionScript <= actualVersion) return callback(null)

  // Load the migration module and run it
  const migrationScriptName = entity.script
  logger.info('Executing %s migration script.', migrationScriptName)

  const migrationScript = require(path.join(__dirname, 'migrations', migrationScriptName))

  db.sequelize.transaction().asCallback(function (err, t) {
    if (err) return callback(err)

    const options = {
      transaction: t,
      queryInterface: db.sequelize.getQueryInterface(),
      sequelize: db.sequelize,
      Sequelize: Sequelize
    }
    migrationScript.up(options, function (err) {
      if (err) {
        t.rollback()
        return callback(err)
      }

      // Update the new migration version
      db.Application.updateMigrationVersion(versionScript, t, function (err) {
        if (err) {
          t.rollback()
          return callback(err)
        }

        t.commit().asCallback(callback)
      })
    })
  })
}
