'use strict'

const eachSeries = require('async/eachSeries')
const fs = require('fs')
const path = require('path')

const constants = require('./constants')
const db = require('./database')
const logger = require('../helpers/logger')

const migrator = {
  migrate: migrate
}

function migrate (callback) {
  db.Application.loadMigrationVersion(function (err, actualVersion) {
    if (err) return callback(err)

    // If there are a new migration scripts
    if (actualVersion < constants.LAST_MIGRATION_VERSION) {
      logger.info('Begin migrations.')

      getMigrationScripts(function (err, migrationScripts) {
        if (err) return callback(err)

        eachSeries(migrationScripts, function (entity, callbackEach) {
          executeMigration(actualVersion, entity, callbackEach)
        }, function (err) {
          if (err) return callback(err)

          logger.info('Migrations finished. New migration version schema: %s', constants.LAST_MIGRATION_VERSION)
          return callback(null)
        })
      })
    } else {
      return callback(null)
    }
  })
}

// ---------------------------------------------------------------------------

module.exports = migrator

// ---------------------------------------------------------------------------

function getMigrationScripts (callback) {
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

function executeMigration (actualVersion, entity, callback) {
  const versionScript = entity.version

  // Do not execute old migration scripts
  if (versionScript <= actualVersion) return callback(null)

  // Load the migration module and run it
  const migrationScriptName = entity.script
  logger.info('Executing %s migration script.', migrationScriptName)

  const migrationScript = require(path.join(__dirname, 'migrations', migrationScriptName))

  db.sequelize.transaction().asCallback(function (err, t) {
    if (err) return callback(err)

    migrationScript.up({ transaction: t }, function (err) {
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
