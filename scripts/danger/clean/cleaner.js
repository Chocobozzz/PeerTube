const rimraf = require('rimraf')
const mongoose = require('mongoose')
mongoose.Promise = global.Promise

const constants = require('../../../server/initializers/constants')

const mongodbUrl = 'mongodb://' + constants.CONFIG.DATABASE.HOSTNAME + ':' + constants.CONFIG.DATABASE.PORT + '/' + constants.CONFIG.DATABASE.DBNAME
mongoose.connect(mongodbUrl, function () {
  console.info('Deleting MongoDB %s database.', constants.CONFIG.DATABASE.DBNAME)
  mongoose.connection.dropDatabase(function () {
    mongoose.connection.close()
  })
})

const STORAGE = constants.CONFIG.STORAGE
Object.keys(STORAGE).forEach(function (storage) {
  const storageDir = STORAGE[storage]

  rimraf(storageDir, function (err) {
    if (err) throw err

    console.info('Deleting %s.', storageDir)
  })
})
