'use strict'

const fs = require('fs')
const path = require('path')
const Sequelize = require('sequelize')

const constants = require('../initializers/constants')
const logger = require('../helpers/logger')
const utils = require('../helpers/utils')

const database = {}

const sequelize = new Sequelize(constants.CONFIG.DATABASE.DBNAME, 'peertube', 'peertube', {
  dialect: 'postgres',
  host: constants.CONFIG.DATABASE.HOSTNAME,
  port: constants.CONFIG.DATABASE.PORT,
  benchmark: utils.isTestInstance(),

  logging: function (message, benchmark) {
    let newMessage = message
    if (benchmark !== undefined) {
      newMessage += ' | ' + benchmark + 'ms'
    }

    logger.debug(newMessage)
  }
})

const modelDirectory = path.join(__dirname, '..', 'models')
fs.readdir(modelDirectory, function (err, files) {
  if (err) throw err

  files.filter(function (file) {
    if (file === 'utils.js') return false

    return true
  })
  .forEach(function (file) {
    const model = sequelize.import(path.join(modelDirectory, file))

    database[model.name] = model
  })

  Object.keys(database).forEach(function (modelName) {
    if ('associate' in database[modelName]) {
      database[modelName].associate(database)
    }
  })

  logger.info('Database is ready.')
})

database.sequelize = sequelize
database.Sequelize = Sequelize

// ---------------------------------------------------------------------------

module.exports = database
