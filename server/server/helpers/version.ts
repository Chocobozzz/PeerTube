import { execPromise, execPromise2 } from './core-utils.js'
import { logger } from './logger.js'

async function getServerCommit () {
  try {
    const tag = await execPromise2(
      '[ ! -d .git ] || git name-rev --name-only --tags --no-undefined HEAD 2>/dev/null || true',
      { stdio: [ 0, 1, 2 ] }
    )

    if (tag) return tag.replace(/^v/, '')
  } catch (err) {
    logger.debug('Cannot get version from git tags.', { err })
  }

  try {
    const version = await execPromise('[ ! -d .git ] || git rev-parse --short HEAD')

    if (version) return version.toString().trim()
  } catch (err) {
    logger.debug('Cannot get version from git HEAD.', { err })
  }

  return ''
}

function getNodeABIVersion () {
  const version = process.versions.modules

  return parseInt(version)
}

export {
  getServerCommit,
  getNodeABIVersion
}
