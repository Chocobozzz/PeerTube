'use strict'

const eachSeries = require('async/eachSeries')
const mongoose = require('mongoose')
const path = require('path')

const constants = require('./constants')
const logger = require('../helpers/logger')

const Application = mongoose.model('Application')

const migrator = {
  migrate: migrate
}

function migrate (callback) {
  Application.loadMongoSchemaVersion(function (err, actualVersion) {
    if (err) return callback(err)

    // If there are a new mongo schemas
    if (!actualVersion || actualVersion < constants.LAST_MONGO_SCHEMA_VERSION) {
      logger.info('Begin migrations.')

      eachSeries(constants.MONGO_MIGRATION_SCRIPTS, function (entity, callbackEach) {
        const versionScript = entity.version

        // Do not execute old migration scripts
        if (versionScript <= actualVersion) return callbackEach(null)

        // Load the migration module and run it
        const migrationScriptName = entity.script
        logger.info('Executing %s migration script.', migrationScriptName)

        const migrationScript = require(path.join(__dirname, 'migrations', migrationScriptName))
        migrationScript.up(function (err) {
          if (err) return callbackEach(err)

          // Update the new mongo version schema
          Application.updateMongoSchemaVersion(versionScript, callbackEach)
        })
      }, function (err) {
        if (err) return callback(err)

        logger.info('Migrations finished. New mongo version schema: %s', constants.LAST_MONGO_SCHEMA_VERSION)
        return callback(null)
      })
    } else {
      return callback(null)
    }
  })
}

// ---------------------------------------------------------------------------

module.exports = migrator

