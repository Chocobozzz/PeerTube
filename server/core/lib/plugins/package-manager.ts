import { isStableOrUnstableVersionValid } from '@server/helpers/custom-validators/misc.js'
import { outputJSON, pathExists, remove } from 'fs-extra/esm'
import { readFile, writeFile } from 'fs/promises'
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

  const { stdout } = await execPNPM('add ' + toInstall)

  logger.debug('Added a pnpm package.', { stdout })
}

export async function installNpmPluginFromDisk (path: string) {
  await execPNPM('add file:' + path)
}

export async function removeNpmPlugin (name: string) {
  checkNpmPluginNameOrThrow(name)

  await execPNPM('remove ' + name)
}

export async function rebuildNativePlugins () {
  await execPNPM('rebuild')
}

// ---------------------------------------------------------------------------

async function execPNPM (command: string) {
  try {
    const pluginDirectory = CONFIG.STORAGE.PLUGINS_DIR

    return execShell(`pnpm ${command}`, { cwd: pluginDirectory })
  } catch (result) {
    logger.error('Cannot exec pnpm.', { command, err: result.err, stderr: result.stderr })

    throw result.err as Error
  }
}

function checkNpmPluginNameOrThrow (name: string) {
  if (!isNpmPluginNameValid(name)) throw new Error('Invalid NPM plugin name to install')
}

function checkPluginVersionOrThrow (name: string) {
  if (!isStableOrUnstableVersionValid(name)) throw new Error('Invalid NPM plugin version to install')
}

// ---------------------------------------------------------------------------

export async function initPNPM () {
  const pluginDirectory = CONFIG.STORAGE.PLUGINS_DIR

  const pluginPackageJSON = join(pluginDirectory, 'package.json')

  // Create empty package.json file if needed
  if (!await pathExists(pluginPackageJSON)) {
    logger.info('Init package.json in plugin directory')

    await outputJSON(pluginPackageJSON, {})
  } else {
    try {
      let packageJSONContent = await readFile(pluginPackageJSON, 'utf-8')

      if (packageJSONContent.includes('"packageManager"')) {
        packageJSONContent = packageJSONContent.replace(/\s*"packageManager".*/g, '')

        await writeFile(pluginPackageJSON, packageJSONContent, 'utf-8')
      }
    } catch (err) {
      logger.error('Cannot sanitize package.json in plugin directory', { err })
    }
  }

  const pnpmWorkspace = join(pluginDirectory, 'pnpm-workspace.yaml')
  if (!await pathExists(pnpmWorkspace)) {
    logger.info('Init pnpm-workspace.yaml in plugin directory')

    await writeFile(pnpmWorkspace, 'dangerouslyAllowAllBuilds: true\nnodeLinker: hoisted\n')
  }

  if (await pathExists(join(pluginDirectory, 'yarn.lock'))) {
    logger.info('Migrate from yarn.lock in plugin directory')

    try {
      await execPNPM('import')
      await remove(join(pluginDirectory, 'yarn.lock'))
    } catch (err) {
      logger.error(
        'Cannot migrate from yarn.lock in plugin directory. Please fix this error to not break PeerTube plugins/themes.',
        { err }
      )
    }
  }
}
