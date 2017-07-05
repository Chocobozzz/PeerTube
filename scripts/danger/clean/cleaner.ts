import * as rimraf from 'rimraf'
import * as Promise from 'bluebird'

import { CONFIG } from '../../../server/initializers/constants'
import { database as db } from '../../../server/initializers/database'

db.init(true)
  .then(() => {
    return db.sequelize.drop()
  })
  .then(() => {
    console.info('Tables of %s deleted.', CONFIG.DATABASE.DBNAME)

    const STORAGE = CONFIG.STORAGE
    Promise.mapSeries(Object.keys(STORAGE), storage => {
      const storageDir = STORAGE[storage]

      return new Promise((res, rej) => {
        rimraf(storageDir, function (err) {
          if (err) return rej(err)

          console.info('%s deleted.', storageDir)
          return res()
        })
      })
    })
    .then(() => process.exit(0))
  })
