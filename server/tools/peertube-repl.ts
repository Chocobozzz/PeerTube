import * as repl from 'repl'
import * as path from 'path'
import * as _ from 'lodash'
import * as uuidv1 from 'uuid/v1'
import * as uuidv3 from 'uuid/v3'
import * as uuidv4 from 'uuid/v4'
import * as uuidv5 from 'uuid/v5'
import * as Sequelize from 'sequelize'
import * as YoutubeDL from 'youtube-dl'

import { initDatabaseModels, sequelizeTypescript } from '../initializers'
import * as cli from '../tools/cli'
import { logger } from '../helpers/logger'
import * as constants from '../initializers/constants'
import * as modelsUtils from '../models/utils'
import * as coreUtils from '../helpers/core-utils'
import * as ffmpegUtils from '../helpers/ffmpeg-utils'
import * as peertubeCryptoUtils from '../helpers/peertube-crypto'
import * as signupUtils from '../helpers/signup'
import * as utils from '../helpers/utils'
import * as YoutubeDLUtils from '../helpers/youtube-dl'

const start = async () => {
  await initDatabaseModels(true)

  const versionCommitHash = await utils.getServerCommit()

  const initContext = (replServer) => {
    return (context) => {
      const properties = {
        context, repl: replServer, env: process.env,
        lodash: _, path,
        uuidv1, uuidv3, uuidv4, uuidv5,
        cli, logger, constants,
        Sequelize, sequelizeTypescript, modelsUtils,
        models: sequelizeTypescript.models, transaction: sequelizeTypescript.transaction,
        query: sequelizeTypescript.query, queryInterface: sequelizeTypescript.getQueryInterface(),
        YoutubeDL,
        coreUtils, ffmpegUtils, peertubeCryptoUtils, signupUtils, utils, YoutubeDLUtils
      }

      for (let prop in properties) {
        Object.defineProperty(context, prop, {
          configurable: false,
          enumerable: true,
          value: properties[prop]
        })
      }
    }
  }

  const replServer = repl.start({
    prompt: `PeerTube [${cli.version}] (${versionCommitHash})> `
  })

  initContext(replServer)(replServer.context)
  replServer.on('reset', initContext(replServer))
  replServer.on('exit', () => process.exit())

  const resetCommand = {
    help: 'Reset REPL',
    action () {
      this.write('.clear\n')
      this.displayPrompt()
    }
  }
  replServer.defineCommand('reset', resetCommand)
  replServer.defineCommand('r', resetCommand)

}

start().then((data) => {
  // do nothing
}).catch((err) => {
  console.error(err)
})
