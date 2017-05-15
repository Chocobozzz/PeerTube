import fs = require('fs')
import { join } from 'path'
import Sequelize = require('sequelize')

import { CONFIG } from './constants'
// Do not use barrel, we need to load database first
import { logger } from '../helpers/logger'
import { isTestInstance } from '../helpers/utils'

const dbname = CONFIG.DATABASE.DBNAME
const username = CONFIG.DATABASE.USERNAME
const password = CONFIG.DATABASE.PASSWORD

const database: any = {}

const sequelize = new Sequelize(dbname, username, password, {
  dialect: 'postgres',
  host: CONFIG.DATABASE.HOSTNAME,
  port: CONFIG.DATABASE.PORT,
  benchmark: isTestInstance(),

  logging: function (message, benchmark) {
    let newMessage = message
    if (benchmark !== undefined) {
      newMessage += ' | ' + benchmark + 'ms'
    }

    logger.debug(newMessage)
  }
})

database.sequelize = sequelize

database.init = function (silent, callback) {
  if (!callback) {
    callback = silent
    silent = false
  }

  if (!callback) callback = function () { /* empty */ }

  const modelDirectory = join(__dirname, '..', 'models')
  fs.readdir(modelDirectory, function (err, files) {
    if (err) throw err

    files.filter(function (file) {
      // For all models but not utils.js
      if (file === 'utils.js') return false

      return true
    })
    .forEach(function (file) {
      const model = sequelize.import(join(modelDirectory, file))

      database[model['name']] = model
    })

    Object.keys(database).forEach(function (modelName) {
      if ('associate' in database[modelName]) {
        database[modelName].associate(database)
      }
    })

    if (!silent) logger.info('Database %s is ready.', dbname)

    return callback(null)
  })
}

// ---------------------------------------------------------------------------

module.exports = database
