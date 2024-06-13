import { parse, stringify } from '@iarna/toml'
import { TranscriptionEngineName, WhisperBuiltinModelName } from '@peertube/peertube-transcription'
import envPaths from 'env-paths'
import { ensureDir, pathExists, remove } from 'fs-extra/esm'
import { readFile, writeFile } from 'fs/promises'
import merge from 'lodash-es/merge.js'
import { dirname, join } from 'path'
import { logger } from '../shared/index.js'

const paths = envPaths('peertube-runner')

type Config = {
  jobs: {
    concurrency: number
  }

  ffmpeg: {
    threads: number
    nice: number
  }

  registeredInstances: {
    url: string
    runnerToken: string
    runnerName: string
    runnerDescription?: string
  }[]

  transcription: {
    engine: TranscriptionEngineName
    enginePath: string | null
    model: WhisperBuiltinModelName
    modelPath: string | null
  }
}

export class ConfigManager {
  private static instance: ConfigManager

  private config: Config = {
    jobs: {
      concurrency: 2
    },
    ffmpeg: {
      threads: 2,
      nice: 20
    },
    transcription: {
      engine: 'whisper-ctranslate2',
      enginePath: null,
      model: 'small',
      modelPath: null
    },
    registeredInstances: []
  }

  private id: string
  private configFilePath: string

  private constructor () {}

  init (id: string) {
    this.id = id
    this.configFilePath = join(this.getConfigDir(), 'config.toml')
  }

  async load () {
    logger.info(`Using ${this.configFilePath} as configuration file`)

    if (this.isTestInstance()) {
      logger.info('Removing configuration file as we are using the "test" id')
      await remove(this.configFilePath)
    }

    await ensureDir(dirname(this.configFilePath))

    if (!await pathExists(this.configFilePath)) {
      await this.save()
    }

    const file = await readFile(this.configFilePath, 'utf-8')

    this.config = merge(this.config, parse(file))
  }

  save () {
    return writeFile(this.configFilePath, stringify(this.config))
  }

  // ---------------------------------------------------------------------------

  async setRegisteredInstances (registeredInstances: {
    url: string
    runnerToken: string
    runnerName: string
    runnerDescription?: string
  }[]) {
    this.config.registeredInstances = registeredInstances

    await this.save()
  }

  // ---------------------------------------------------------------------------

  getConfig () {
    return this.deepFreeze(this.config)
  }

  // ---------------------------------------------------------------------------

  getTranscodingDirectory () {
    return join(paths.cache, this.id, 'transcoding')
  }

  getTranscriptionDirectory () {
    return join(paths.cache, this.id, 'transcription')
  }

  getSocketDirectory () {
    return join(paths.data, this.id)
  }

  getSocketPath () {
    return join(this.getSocketDirectory(), 'peertube-runner.sock')
  }

  getConfigDir () {
    return join(paths.config, this.id)
  }

  // ---------------------------------------------------------------------------

  isTestInstance () {
    return typeof this.id === 'string' && this.id.match(/^test-\d$/)
  }

  // ---------------------------------------------------------------------------

  // Thanks: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
  private deepFreeze <T extends object> (object: T) {
    const propNames = Reflect.ownKeys(object)

    // Freeze properties before freezing self
    for (const name of propNames) {
      const value = object[name]

      if ((value && typeof value === 'object') || typeof value === 'function') {
        this.deepFreeze(value)
      }
    }

    return Object.freeze({ ...object })
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
