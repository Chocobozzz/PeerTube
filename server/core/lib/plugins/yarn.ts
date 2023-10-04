import { outputJSON, pathExists } from 'fs-extra/esm'
import { join } from 'path'
import { execShell } from '../../helpers/core-utils.js'
import { isNpmPluginNameValid, isPluginStableOrUnstableVersionValid } from '../../helpers/custom-validators/plugins.js'
import { logger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { getLatestPluginVersion } from './plugin-index.js'

async function installNpmPlugin (npmName: string, versionArg?: string) {
  // Security check
  checkNpmPluginNameOrThrow(npmName)
  if (versionArg) checkPluginVersionOrThrow(versionArg)

  const version = versionArg || await getLatestPluginVersion(npmName)

  let toInstall = npmName
  if (version) toInstall += `@${version}`

  const { stdout } = await execYarn('add ' + toInstall)

  logger.debug('Added a yarn package.', { yarnStdout: stdout })
}

async function installNpmPluginFromDisk (path: string) {
  await execYarn('add file:' + path)
}

async function removeNpmPlugin (name: string) {
  checkNpmPluginNameOrThrow(name)

  await execYarn('remove ' + name)
}

async function rebuildNativePlugins () {
  await execYarn('install --pure-lockfile')
}

// ############################################################################

export {
  installNpmPlugin,
  installNpmPluginFromDisk,
  rebuildNativePlugins,
  removeNpmPlugin
}

// ############################################################################

async function execYarn (command: string) {
  try {
    const pluginDirectory = CONFIG.STORAGE.PLUGINS_DIR
    const pluginPackageJSON = join(pluginDirectory, 'package.json')

    // Create empty package.json file if needed
    if (!await pathExists(pluginPackageJSON)) {
      await outputJSON(pluginPackageJSON, {})
    }

    return execShell(`yarn ${command}`, { cwd: pluginDirectory })
  } catch (result) {
    logger.error('Cannot exec yarn.', { command, err: result.err, stderr: result.stderr })

    throw result.err
  }
}

function checkNpmPluginNameOrThrow (name: string) {
  if (!isNpmPluginNameValid(name)) throw new Error('Invalid NPM plugin name to install')
}

function checkPluginVersionOrThrow (name: string) {
  if (!isPluginStableOrUnstableVersionValid(name)) throw new Error('Invalid NPM plugin version to install')
}
