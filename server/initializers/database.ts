import * as fs from 'fs'
import { join } from 'path'
import * as Sequelize from 'sequelize'
import { each } from 'async'

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

  getModelFiles(modelDirectory, function (err, filePaths) {
    if (err) throw err

    filePaths.forEach(function (filePath) {
      const model = sequelize.import(filePath)

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

// ---------------------------------------------------------------------------

function getModelFiles (modelDirectory: string, callback: (err: Error, filePaths: string[]) => void) {
  fs.readdir(modelDirectory, function (err, files) {
    if (err) throw err

    const directories = files.filter(function (directory) {
      // For all models but not utils.js
      if (
        directory === 'index.js' || directory === 'index.ts' ||
        directory === 'utils.js' || directory === 'utils.ts'
      ) return false

      return true
    })

    let modelFilePaths: string[] = []

    // For each directory we read it and append model in the modelFilePaths array
    each(directories, function (directory: string, eachCallback: ErrorCallback<Error>) {
      const modelDirectoryPath = join(modelDirectory, directory)

      fs.readdir(modelDirectoryPath, function (err, files) {
        if (err) return eachCallback(err)

        const filteredFiles = files.filter(file => {
          if (
            file === 'index.js' || file === 'index.ts' ||
            file === 'utils.js' || file === 'utils.ts' ||
            file.endsWith('-interface.js') || file.endsWith('-interface.ts') ||
            file.endsWith('.js.map')
          ) return false

          return true
        }).map(file => {
          return join(modelDirectoryPath, file)
        })

        modelFilePaths = modelFilePaths.concat(filteredFiles)

        return eachCallback(null)
      })
    }, function(err: Error) {
      return callback(err, modelFilePaths)
    })
  })
}
