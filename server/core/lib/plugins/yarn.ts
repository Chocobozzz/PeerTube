import { copy, ensureSymlink, remove, outputJSON, pathExists, ensureDir } from 'fs-extra/esm'
import { readlink } from 'fs/promises'
import { join } from 'path'
import { execShell, getContentHash } from '../../helpers/core-utils.js'
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

  const stdout = await execYarn('add ' + toInstall)

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
  const latestDirectory = join(CONFIG.STORAGE.PLUGINS_DIR, 'latest')
  const currentDirectory = await readlink(latestDirectory)
  let workingDirectory: string
  let stdout: string

  try {
    const pluginPackageJSON = join(currentDirectory, 'package.json')

    // Create empty package.json file if needed
    if (!await pathExists(pluginPackageJSON)) {
      await outputJSON(pluginPackageJSON, {})
    }

    const hash = await getContentHash(pluginPackageJSON)

    workingDirectory = join(CONFIG.STORAGE.PLUGINS_DIR, hash)
    await ensureDir(workingDirectory)
    await copy(join(currentDirectory, 'package.json'), join(workingDirectory, 'package.json'))

    try {
      await copy(join(currentDirectory, 'yarn.lock'), join(workingDirectory, 'yarn.lock'))
    } catch (err) {
      logger.debug('No yarn.lock file to copy, will continue without.')
    }

    const result = await execShell(`yarn ${command}`, { cwd: workingDirectory })
    stdout = result.stdout
  } catch (result) {
    logger.error('Cannot exec yarn.', { command, err: result, stderr: result.stderr })

    await remove(workingDirectory)

    throw result.err
  }

  try {
    await remove(latestDirectory)
    await ensureSymlink(workingDirectory, latestDirectory)
  } catch (err) {
    logger.error('Cannot create symlink for new plugin set. Trying to restore the old one.', { err })
    await ensureSymlink(currentDirectory, latestDirectory)
    logger.info('Succeeded to restore old plugin set.')

    throw err
  }

  await remove(currentDirectory)

  return stdout
}

function checkNpmPluginNameOrThrow (name: string) {
  if (!isNpmPluginNameValid(name)) throw new Error('Invalid NPM plugin name to install')
}

function checkPluginVersionOrThrow (name: string) {
  if (!isPluginStableOrUnstableVersionValid(name)) throw new Error('Invalid NPM plugin version to install')
}
