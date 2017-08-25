import { join } from 'path'
import { flattenDepth } from 'lodash'
import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { CONFIG } from './constants'
// Do not use barrel, we need to load database first
import { logger } from '../helpers/logger'
import { isTestInstance, readdirPromise } from '../helpers/core-utils'
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
  VideoFileModel,
  VideoTagModel,
  VideoModel
} from '../models'

const dbname = CONFIG.DATABASE.DBNAME
const username = CONFIG.DATABASE.USERNAME
const password = CONFIG.DATABASE.PASSWORD

const database: {
  sequelize?: Sequelize.Sequelize,
  init?: (silent: boolean) => Promise<void>,

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
  VideoFile?: VideoFileModel,
  BlacklistedVideo?: BlacklistedVideoModel,
  VideoTag?: VideoTagModel,
  Video?: VideoModel
} = {}

const sequelize = new Sequelize(dbname, username, password, {
  dialect: 'postgres',
  host: CONFIG.DATABASE.HOSTNAME,
  port: CONFIG.DATABASE.PORT,
  benchmark: isTestInstance(),

  logging: (message: string, benchmark: number) => {
    let newMessage = message
    if (benchmark !== undefined) {
      newMessage += ' | ' + benchmark + 'ms'
    }

    logger.debug(newMessage)
  }
})

database.sequelize = sequelize

database.init = (silent: boolean) => {
  const modelDirectory = join(__dirname, '..', 'models')

  return getModelFiles(modelDirectory).then(filePaths => {
    filePaths.forEach(filePath => {
      const model = sequelize.import(filePath)

      database[model['name']] = model
    })

    Object.keys(database).forEach(modelName => {
      if ('associate' in database[modelName]) {
        database[modelName].associate(database)
      }
    })

    if (!silent) logger.info('Database %s is ready.', dbname)

    return undefined
  })
}

// ---------------------------------------------------------------------------

export {
  database
}

// ---------------------------------------------------------------------------

function getModelFiles (modelDirectory: string) {
  return readdirPromise(modelDirectory)
    .then(files => {
      const directories: string[] = files.filter(directory => {
        // Find directories
        if (
          directory.endsWith('.js.map') ||
          directory === 'index.js' || directory === 'index.ts' ||
          directory === 'utils.js' || directory === 'utils.ts'
        ) return false

        return true
      })

      return directories
    })
    .then(directories => {
      const tasks = []

      // For each directory we read it and append model in the modelFilePaths array
      directories.forEach(directory => {
        const modelDirectoryPath = join(modelDirectory, directory)

        const promise = readdirPromise(modelDirectoryPath).then(files => {
          const filteredFiles = files.filter(file => {
            if (
              file === 'index.js' || file === 'index.ts' ||
              file === 'utils.js' || file === 'utils.ts' ||
              file.endsWith('-interface.js') || file.endsWith('-interface.ts') ||
              file.endsWith('.js.map')
            ) return false

            return true
          }).map(file => join(modelDirectoryPath, file))

          return filteredFiles
        })

        tasks.push(promise)
      })

      return Promise.all(tasks)
    })
    .then((filteredFiles: string[][]) => {
      return flattenDepth<string>(filteredFiles, 1)
    })
}
