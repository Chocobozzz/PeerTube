import { isStableOrUnstableVersionValid } from '@server/helpers/custom-validators/misc.js'
import { execa } from 'execa'
import { outputJSON, pathExists, remove } from 'fs-extra/esm'
import { readFile, rename, writeFile } from 'fs/promises'
import { join } from 'path'
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

  const { stdout } = await execPNPM([ 'add', toInstall ])

  logger.debug('Added a pnpm package.', { stdout })
}

export async function installNpmPluginFromDisk (path: string) {
  await execPNPM([ 'add', 'file:' + path ])
}

export async function removeNpmPlugin (name: string) {
  checkNpmPluginNameOrThrow(name)

  await execPNPM([ 'remove', name ])
}

export async function rebuildNativePlugins () {
  await execPNPM([ 'rebuild' ])
}

// ---------------------------------------------------------------------------

async function execPNPM (commands: string[]) {
  const runCommand = () => execa('pnpm', commands, { cwd: CONFIG.STORAGE.PLUGINS_DIR })

  try {
    return await runCommand()
  } catch (result) {
    if (isPNPMUnexpectedStoreError(result)) {
      logger.warn('Cannot exec pnpm because of an unexpected store location. Running pnpm install and retrying command.', { commands })

      const nodeModulesPath = join(CONFIG.STORAGE.PLUGINS_DIR, 'node_modules')
      const nodeModulesBackupPath = join(CONFIG.STORAGE.PLUGINS_DIR, 'node_modules.bak')

      try {
        await rename(nodeModulesPath, nodeModulesBackupPath)

        await execa('pnpm', [ 'install' ], { cwd: CONFIG.STORAGE.PLUGINS_DIR })

        const commandResult = await runCommand()

        remove(nodeModulesBackupPath)
          .catch(err => logger.error('Cannot remove node_modules backup after reinstalling dependencies.', { err }))

        return commandResult
      } catch (retryResult) {
        rename(nodeModulesBackupPath, nodeModulesPath)
          .catch(err => logger.error('Cannot restore node_modules backup after failing to reinstall dependencies.', { err }))

        const err = getErrorFromExecaResult(retryResult)

        logger.error('Cannot recover pnpm command after reinstalling dependencies.', { commands, err, stderr: retryResult?.stderr })

        throw err
      }
    }

    const err = getErrorFromExecaResult(result)

    logger.error('Cannot exec pnpm.', { commands, err, stderr: result?.stderr })

    throw err
  }
}

function getErrorFromExecaResult (result: unknown): Error {
  const execaResult = result as any

  if (execaResult?.err instanceof Error) return execaResult.err
  if (execaResult instanceof Error) return execaResult

  const message = typeof execaResult?.message === 'string'
    ? execaResult.message
    : 'Unknown pnpm execution error'

  return new Error(message)
}

function isPNPMUnexpectedStoreError (result: unknown) {
  const execaResult = result as any

  const output = [
    execaResult?.stdout,
    execaResult?.stderr,
    execaResult?.shortMessage,
    execaResult?.message
  ].filter(value => typeof value === 'string').join('\n')

  return output.includes('ERR_PNPM_UNEXPECTED_STORE') || output.includes('Unexpected store location')
}

// ---------------------------------------------------------------------------

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

      if (packageJSONContent.match(/},\s*}/)) {
        packageJSONContent = packageJSONContent.replace(/},(\s*)}/, '}$1}')

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
      await execPNPM([ 'import' ])
      await remove(join(pluginDirectory, 'yarn.lock'))
    } catch (err) {
      logger.error(
        'Cannot migrate from yarn.lock in plugin directory. Please fix this error to not break PeerTube plugins/themes.',
        { err }
      )
    }
  }
}
