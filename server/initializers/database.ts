import * as fs from 'fs'
import { join } from 'path'
import * as Sequelize from 'sequelize'

import { CONFIG } from './constants'
// Do not use barrel, we need to load database first
import { logger } from '../helpers/logger'
import { isTestInstance } from '../helpers/core-utils'
import {
  ApplicationModel,
  AuthorModel,
  JobModel,
  OAuthClientModel,
  OAuthTokenModel,
  PodModel,
  RequestModel,
  RequestToPodModel,
  RequestVideoEventModel,
  RequestVideoQaduModel,
  TagModel,
  UserModel,
  UserVideoRateModel,
  VideoAbuseModel,
  BlacklistedVideoModel,
  VideoTagModel,
  VideoModel
} from '../models'

const dbname = CONFIG.DATABASE.DBNAME
const username = CONFIG.DATABASE.USERNAME
const password = CONFIG.DATABASE.PASSWORD

const database: {
  sequelize?: Sequelize.Sequelize,
  init?: (silent: any, callback: any) => void,

  Application?: ApplicationModel,
  Author?: AuthorModel,
  Job?: JobModel,
  OAuthClient?: OAuthClientModel,
  OAuthToken?: OAuthTokenModel,
  Pod?: PodModel,
  RequestToPod?: RequestToPodModel,
  RequestVideoEvent?: RequestVideoEventModel,
  RequestVideoQadu?: RequestVideoQaduModel,
  Request?: RequestModel,
  Tag?: TagModel,
  UserVideoRate?: UserVideoRateModel,
  User?: UserModel,
  VideoAbuse?: VideoAbuseModel,
  BlacklistedVideo?: BlacklistedVideoModel,
  VideoTag?: VideoTagModel,
  Video?: VideoModel
} = {}

const sequelize = new Sequelize(dbname, username, password, {
  dialect: 'postgres',
  host: CONFIG.DATABASE.HOSTNAME,
  port: CONFIG.DATABASE.PORT,
  benchmark: isTestInstance(),

  logging: function (message: string, benchmark: number) {
    let newMessage = message
    if (benchmark !== undefined) {
      newMessage += ' | ' + benchmark + 'ms'
    }

    logger.debug(newMessage)
  }
})

database.sequelize = sequelize

database.init = function (silent: boolean, callback: (err: Error) => void) {

  const modelDirectory = join(__dirname, '..', 'models')
  fs.readdir(modelDirectory, function (err, files) {
    if (err) throw err

    files.filter(function (file) {
      // For all models but not utils.js
      if (
        file === 'index.js' || file === 'index.ts' ||
        file === 'utils.js' || file === 'utils.ts' ||
        file.endsWith('-interface.js') || file.endsWith('-interface.ts') ||
        file.endsWith('.js.map')
      ) return false

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

export {
  database
}
