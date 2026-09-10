import { Load, Util, type ConfigSource } from 'config/lib/util.js'
import { basename } from 'path'
import { isSecondaryProcess } from '../process-role.js'
import { buildRedisClientOptions } from './redis-options.js'
import {
  buildInstanceHost,
  decodePublishedConfig,
  getPublishedConfig,
  setPublishedConfig,
  SHARED_CONFIG_REDIS_KEY
} from './shared-config.js'

/**
 * Build manually configuration using `config` module helper
 * So we can easily invalidate configuration ourselves (instead of clearing module cache)
 * Logger is unavailable at this point, so we fall back to console methods
 */

export type ConfigInstance = {
  get: <T>(property: string) => T
  has: (property: string) => boolean

  // Whole merged configuration, used by the primary to publish it to the other processes
  toObject: () => object

  util: {
    getConfigSources: () => ConfigSource[]
    getEnv: (varName: string) => string
  }
}

let instance: ConfigInstance

export async function initConfig () {
  // A secondary process does not start with a partial configuration
  // It would silently fall back to the defaults of config/default.yaml
  if (isSecondaryProcess()) await injectPublishedConfig()

  instance = buildConfigInstance()

  return instance
}

export function reloadConfigInstance () {
  instance = buildConfigInstance()

  return instance
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildConfigInstance (options: {
  strictnessChecks?: boolean
} = {}): ConfigInstance {
  const load = Load.fromEnvironment(undefined)

  const additional: { name: string, config: any }[] = []
  let envConfig: any = {}
  let cmdLineConfig: any = {}

  load.setEnv('CONFIG_DIR', load.options.configDir)

  // A secondary process runs with the configuration of the primary
  // It overrides the local files, but allows `$NODE_CONFIG` and `--NODE_CONFIG` to override primary config
  const publishedConfig = getPublishedConfig()
  if (publishedConfig) {
    additional.push({ name: 'primary process', config: publishedConfig })
  }

  if (process.env.NODE_CONFIG) {
    try {
      envConfig = JSON.parse(process.env.NODE_CONFIG)
    } catch {
      console.error('The $NODE_CONFIG environment variable is malformed JSON')
    }

    additional.push({ name: '$NODE_CONFIG', config: envConfig })
  }

  const cmdLineArg = load.getCmdLineArg('NODE_CONFIG')
  if (cmdLineArg) {
    try {
      cmdLineConfig = JSON.parse(cmdLineArg)
    } catch {
      console.error('The --NODE_CONFIG={json} command line argument is malformed JSON')
    }

    additional.push({ name: '--NODE_CONFIG argument', config: cmdLineConfig })
  }

  // Place the mixed NODE_CONFIG into the environment
  load.setEnv('NODE_CONFIG', JSON.stringify(Util.extendDeep({}, envConfig, cmdLineConfig)))

  load.scan(additional)

  if (options.strictnessChecks !== false) {
    runStrictnessChecks(load)
  }

  if (!load.initParam('SUPPRESS_NO_CONFIG_WARNING') && Object.keys(load.config).length === 0) {
    console.error('WARNING: No configurations found in configuration directory: ' + load.options.configDir)
    console.error('WARNING: To disable this warning set SUPPRESS_NO_CONFIG_WARNING in the environment.')
  }

  // Ensure the configuration cannot be accidentally mutated at runtime
  if (!load.initParam('ALLOW_CONFIG_MUTATIONS', false)) {
    Util.makeImmutable(load.config)
  }

  return {
    get: <T>(property: string): T => {
      const value = Util.getPath(load.config, property)
      if (value === undefined) throw new Error(`Configuration property "${property}" is not defined`)

      return value
    },
    has: (property: string): boolean => Util.getPath(load.config, property) !== undefined,

    toObject: (): object => load.config,

    util: {
      getConfigSources: () => load.getSources(),
      getEnv: (varName: string) => load.getEnv(varName)
    }
  }
}

// Warn (or throw if NODE_CONFIG_STRICT_MODE is set) when NODE_ENV/NODE_APP_INSTANCE match no config file
// See https://github.com/node-config/node-config/wiki/Strict-Mode
function runStrictnessChecks (load: Load) {
  if (load.initParam('SUPPRESS_STRICTNESS_CHECK')) return

  const sourceFilenames = load.getSources().map(s => basename(s.name))

  const warnOrThrow = (message: string) => {
    const beStrict = process.env.NODE_CONFIG_STRICT_MODE
    const prefix = beStrict ? 'FATAL: ' : 'WARNING: '
    const seeURL = 'See https://github.com/node-config/node-config/wiki/Strict-Mode'

    console.error(prefix + message)
    console.error(prefix + seeURL)

    if ([ 'true', '1' ].includes(beStrict)) throw new Error(prefix + message + ' ' + seeURL)
  }

  for (const env of load.options.nodeEnv) {
    // Anchored regex to avoid false positives, so `test` does not match `contest.yaml`
    const anyFileMatchesEnv = sourceFilenames.some(filename => new RegExp(`^${env}[.-]`).test(filename))

    // development is special cased because it's the default value
    if (env && env !== 'development' && !anyFileMatchesEnv) {
      warnOrThrow(`${load.getEnv('nodeEnv')} value of '${env}' did not match any deployment config file names.`)
    }

    if (env === 'default' || env === 'local') {
      warnOrThrow(`${load.getEnv('nodeEnv')} value of '${env}' is ambiguous.`)
    }
  }

  const appInstance = load.options.appInstance
  if (appInstance && !sourceFilenames.some(filename => filename.includes(appInstance))) {
    warnOrThrow(`NODE_APP_INSTANCE value of '${appInstance}' did not match any instance config file names.`)
  }
}

// ---------------------------------------------------------------------------

// Fetch the instance configuration a secondary process must run with, and inject it in memory
async function injectPublishedConfig () {
  const localConfig = buildConfigInstance({ strictnessChecks: false })

  const instanceHost = buildInstanceHost({
    hostname: localConfig.get('webserver.hostname'),
    port: localConfig.get('webserver.port')
  })
  const key = 'redis-' + instanceHost + '-' + SHARED_CONFIG_REDIS_KEY

  const secret = localConfig.has('secrets.peertube')
    ? localConfig.get<string>('secrets.peertube')
    : ''

  if (!secret) {
    exitWithError(
      '"secrets.peertube" is missing in the local configuration of this process.\n' +
        'It decrypts the configuration published by the primary, so both processes must use the same value.'
    )
  }

  const raw = await readPublishedConfig(localConfig, key, instanceHost)

  const { instance: publishedInstance, config } = await decodePublishedConfig(raw, secret)
    .catch(() =>
      exitWithError(
        `The configuration published by the primary process of "${instanceHost}" cannot be decrypted.\n` +
          'Ensure "secrets.peertube" has the same value as the primary process.'
      )
    )

  // Cannot normally happen
  if (publishedInstance !== instanceHost) {
    exitWithError(
      `The configuration published in Redis belongs to "${publishedInstance}" but this process is "${instanceHost}".`
    )
  }

  setPublishedConfig(config)
}

async function readPublishedConfig (localConfig: ConfigInstance, key: string, instanceHost: string) {
  // Do not import at the top level so a primary process never loads ioredis this early
  const { Redis: IoRedis } = await import('ioredis')

  const client = new IoRedis(buildRedisClientOptions({ config: localConfig, name: 'Bootstrap' }))

  try {
    const value = await client.get(key)

    if (!value) {
      exitWithError(
        `No configuration published by the primary process of "${instanceHost}".\n` +
          'Start the primary process first, and check that both processes share the same Redis and the same "webserver" configuration.'
      )
    }

    return value
  } catch (err) {
    exitWithError(`Cannot read the configuration published by the primary process: ${(err as Error).message}`)
  } finally {
    client.disconnect()
  }
}

function exitWithError (message: string): never {
  // Don't use logger since we have not imported it yet
  console.error('Cannot start this secondary process.\n' + message)

  process.exit(1)
}
