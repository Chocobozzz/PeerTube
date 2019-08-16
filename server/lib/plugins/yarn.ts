import { execShell } from '../../helpers/core-utils'
import { logger } from '../../helpers/logger'
import { isNpmPluginNameValid, isPluginVersionValid } from '../../helpers/custom-validators/plugins'
import { CONFIG } from '../../initializers/config'
import { outputJSON, pathExists } from 'fs-extra'
import { join } from 'path'

async function installNpmPlugin (npmName: string, version?: string) {
  // Security check
  checkNpmPluginNameOrThrow(npmName)
  if (version) checkPluginVersionOrThrow(version)

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

// ############################################################################

export {
  installNpmPlugin,
  installNpmPluginFromDisk,
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
  if (!isPluginVersionValid(name)) throw new Error('Invalid NPM plugin version to install')
}
