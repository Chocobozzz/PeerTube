import { buildUUID } from '@peertube/peertube-node-utils'
import { decrypt, encrypt } from '@server/helpers/encryption.js'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { SCHEDULER_INTERVALS_MS } from '@server/initializers/constants.js'
import { isSecondaryProcess } from '@server/initializers/process-role.js'
import { pathExists, remove } from 'fs-extra/esm'
import { readFile, rename, writeFile } from 'fs/promises'
import { join } from 'path'
import { Redis } from './redis/index.js'

const logger = createLogger('youtube-dl')

const COOKIES_FILENAME = 'youtube-cookies.txt'

// The admin puts the cookies file in the persistent temporary directory of the primary process
export function getYoutubeDLCookiesPath () {
  return join(CONFIG.STORAGE.TMP_PERSISTENT_DIR, COOKIES_FILENAME)
}

// ---------------------------------------------------------------------------
// Primary
// ---------------------------------------------------------------------------

const NOT_PUBLISHED = Symbol('not-published')

// Plain content of the last cookies file published in Redis, undefined if removed
let publishedContent: string | undefined | typeof NOT_PUBLISHED = NOT_PUBLISHED

let publishing = Promise.resolve()

// The primary publishes the cookies file in Redis, so secondaries can use it too
export function watchYoutubeDLCookies () {
  const path = getYoutubeDLCookiesPath()

  if (!CONFIG.IMPORT.VIDEOS.HTTP.COOKIES.ENABLED) {
    // Previous run publication?
    Redis.Instance.deleteYoutubeDLCookies()
      .catch(err => logger.error('Cannot unpublish yt-dlp cookies file %s.', path, { err }))

    return
  }

  const publish = () => {
    publishing = publishing
      .then(() => publishYoutubeDLCookies(path))
      .catch(err => logger.error('Cannot publish yt-dlp cookies file %s to the other processes.', path, { err }))
  }

  publish()

  setInterval(publish, SCHEDULER_INTERVALS_MS.YOUTUBE_DL_COOKIES_WATCH).unref()
}

async function publishYoutubeDLCookies (path: string) {
  const content = await pathExists(path)
    ? await readFile(path, 'utf8')
    : undefined

  if (content === publishedContent) {
    if (content === undefined || await Redis.Instance.getYoutubeDLCookies()) return

    logger.warn('yt-dlp cookies file %s is not in Redis anymore, publishing it again.', path)
  }

  if (content === undefined) {
    if (publishedContent !== NOT_PUBLISHED) {
      logger.info('yt-dlp cookies file %s removed, unpublishing it.', path)
    }

    await Redis.Instance.deleteYoutubeDLCookies()
  } else {
    logger.info('Publishing yt-dlp cookies file %s to the other processes.', path)

    await Redis.Instance.setYoutubeDLCookies(await encrypt(content, CONFIG.SECRETS.PEERTUBE))
  }

  publishedContent = content
}

// ---------------------------------------------------------------------------
// Cookies file used by yt-dlp in this process
// ---------------------------------------------------------------------------

// Secondary: encrypted cookies published by the primary that we wrote in our local cookies file
let writtenEncrypted: string

export async function getYoutubeDLCookiesPathIfEnabled () {
  if (!CONFIG.IMPORT.VIDEOS.HTTP.COOKIES.ENABLED) return undefined

  let cookiesPath: string

  try {
    cookiesPath = await getYoutubeDLCookiesPathForProcess()
  } catch (err) {
    logger.error('Cannot get yt-dlp cookies file published by the primary process. Continuing without cookies.', { err })
    return undefined
  }

  if (!cookiesPath) {
    logger.error(
      'yt-dlp cookies are enabled but the cookies file %s does not exist. Continuing without cookies.',
      getYoutubeDLCookiesPath()
    )
  }

  return cookiesPath
}

// Secondaries on another host use the cookies file published by the primary
async function getYoutubeDLCookiesPathForProcess () {
  if (!isSecondaryProcess()) {
    const path = getYoutubeDLCookiesPath()

    return await pathExists(path)
      ? path
      : undefined
  }

  const encrypted = await Redis.Instance.getYoutubeDLCookies()
  if (!encrypted) return undefined

  const path = join(CONFIG.STORAGE.TMP_DIR, COOKIES_FILENAME)

  if (encrypted !== writtenEncrypted || !await pathExists(path)) {
    const content = await decrypt(encrypted, CONFIG.SECRETS.PEERTUBE)

    // Atomic replacement, a yt-dlp process may be reading it
    const tmpPath = path + '.' + buildUUID()

    try {
      await writeFile(tmpPath, content, { mode: 0o600 })
      await rename(tmpPath, path)
    } catch (err) {
      await remove(tmpPath)
      throw err
    }

    writtenEncrypted = encrypted
  }

  return path
}
