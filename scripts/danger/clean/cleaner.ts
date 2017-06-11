import * as eachSeries from 'async/eachSeries'
import * as rimraf from 'rimraf'

import { CONFIG } from '../../../server/initializers/constants'
import { database as db } from '../../../server/initializers/database'

db.init(true, function () {
  db.sequelize.drop().asCallback(function (err) {
    if (err) throw err

    console.info('Tables of %s deleted.', CONFIG.DATABASE.DBNAME)

    const STORAGE = CONFIG.STORAGE
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
