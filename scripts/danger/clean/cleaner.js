const eachSeries = require('async/eachSeries')
const rimraf = require('rimraf')

const constants = require('../../../server/initializers/constants')
const db = require('../../../server/initializers/database')

db.init(true, function () {
  db.sequelize.drop().asCallback(function (err) {
    if (err) throw err

    console.info('Tables of %s deleted.', db.sequelize.config.database)

    const STORAGE = constants.CONFIG.STORAGE
    eachSeries(Object.keys(STORAGE), function (storage, callbackEach) {
      const storageDir = STORAGE[storage]

      rimraf(storageDir, function (err) {
        console.info('%s deleted.', storageDir)
        return callbackEach(err)
      })
    }, function () {
      process.exit(0)
    })
  })
})
