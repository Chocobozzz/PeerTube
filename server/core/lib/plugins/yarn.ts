import { isStableOrUnstableVersionValid } from '@server/helpers/custom-validators/misc.js'
import { outputJSON, pathExists } from 'fs-extra/esm'
import { join } from 'path'
import { execShell } from '../../helpers/core-utils.js'
import { isNpmPluginNameValid } from '../../helpers/custom-validators/plugins.js'
import { logger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { getLatestPluginVersion } from './plugin-index.js'

export async function installNpmPlugin (npmName: string, versionArg?: string) {
  // Security check
  checkNpmPluginNameOrThrow(npmName)
  if (versionArg) checkPluginVersionOrThrow(versionArg)

  const version = versionArg || await getLatestPluginVersion(npmName)

  let toInstall = npmName
  if (version) toInstall += `@${version}`

  const { stdout } = await execYarn('add ' + toInstall)

  logger.debug('Added a yarn package.', { yarnStdout: stdout })
}

export async function installNpmPluginFromDisk (path: string) {
  await execYarn('add file:' + path)
}

export async function removeNpmPlugin (name: string) {
  checkNpmPluginNameOrThrow(name)

  await execYarn('remove ' + name)
}

export async function rebuildNativePlugins () {
  await execYarn('install --pure-lockfile')
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

    throw result.err as Error
  }
}

function checkNpmPluginNameOrThrow (name: string) {
  if (!isNpmPluginNameValid(name)) throw new Error('Invalid NPM plugin name to install')
}

function checkPluginVersionOrThrow (name: string) {
  if (!isStableOrUnstableVersionValid(name)) throw new Error('Invalid NPM plugin version to install')
}
