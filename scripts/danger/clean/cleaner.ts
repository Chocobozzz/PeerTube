import { registerTSPaths } from '../../../server/helpers/register-ts-paths'
registerTSPaths()

import * as Promise from 'bluebird'
import * as rimraf from 'rimraf'
import { initDatabaseModels, sequelizeTypescript } from '../../../server/initializers/database'
import { CONFIG } from '../../../server/initializers/config'

initDatabaseModels(true)
  .then(() => {
    return sequelizeTypescript.drop()
  })
  .then(() => {
    console.info('Tables of %s deleted.', CONFIG.DATABASE.DBNAME)

    const STORAGE = CONFIG.STORAGE
    return Promise.mapSeries(Object.keys(STORAGE), storage => {
      const storageDir = STORAGE[storage]

      return new Promise((res, rej) => {
        rimraf(storageDir, err => {
          if (err) return rej(err)

          console.info('%s deleted.', storageDir)
          return res()
        })
      })
    })
    .then(() => process.exit(0))
  })
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })
