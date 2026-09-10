import { sha256 } from '@peertube/peertube-node-utils'
import { ensureDir } from 'fs-extra/esm'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { createLogger } from '../helpers/logger.js'
import { CONFIG, getConfigModule } from './config.js'
import { getProcessRole } from './process-role.js'

const logger = createLogger()

/**
 * Two PeerTube processes of the same platform must never share a storage directory because of potential conflicts.
 *
 * A process marks each directory it owns to throw an error on duplicate ownership.
 */

// Content must not be private, some reverse proxy are configured to serve hidden files too
export const STORAGE_OWNER_FILE_NAME = '.peertube-storage-owner'

type StorageOwner = {
  owner: string
  claimedAt: string
}

// To name the setting an administrator has to change
const SETTING_NAMES: { [property in keyof typeof CONFIG.STORAGE]: string } = {
  TMP_DIR: 'tmp',
  TMP_PERSISTENT_DIR: 'tmp_persistent',
  BIN_DIR: 'bin',
  ACTOR_IMAGES_DIR: 'avatars',
  LOG_DIR: 'logs',
  WEB_VIDEOS_DIR: 'web_videos',
  STREAMING_PLAYLISTS_DIR: 'streaming_playlists',
  ORIGINAL_VIDEO_FILES_DIR: 'original_video_files',
  REDUNDANCY_DIR: 'redundancy',
  THUMBNAILS_DIR: 'thumbnails',
  STORYBOARDS_DIR: 'storyboards',
  PREVIEWS_DIR: 'previews',
  CAPTIONS_DIR: 'captions',
  TORRENTS_DIR: 'torrents',
  CACHE_DIR: 'cache',
  PLUGINS_DIR: 'plugins',
  CLIENT_OVERRIDES_DIR: 'client_overrides',
  WELL_KNOWN_DIR: 'well_known',
  UPLOADS_DIR: 'uploads'
}

let processStorageId: string

export function getProcessStorageId () {
  if (processStorageId) return processStorageId

  const configDir = getConfigModule().util.getEnv('CONFIG_DIR') || ''
  const appInstance = process.env.NODE_APP_INSTANCE || ''
  const role = getProcessRole()

  processStorageId = sha256([ role, configDir, appInstance ].join('|'))
    .slice(0, 16) // Keep a short id

  return processStorageId
}

export async function claimStorageDirectories () {
  const id = getProcessStorageId()

  for (const [ property, directory ] of Object.entries(CONFIG.STORAGE)) {
    await ensureDir(directory)

    const ownerPath = join(directory, STORAGE_OWNER_FILE_NAME)
    const owner: StorageOwner = { owner: id, claimedAt: new Date().toISOString() }

    try {
      await writeFile(ownerPath, JSON.stringify(owner), { encoding: 'utf-8', flag: 'wx' })
      continue
    } catch (err) {
      if (err?.code !== 'EEXIST') throw err
    }

    const existing = await readStorageOwner(ownerPath)

    // A file we cannot read (left by a version that wrote something else there): rewrite it
    if (!existing) {
      await writeFile(ownerPath, JSON.stringify(owner), 'utf-8')
      continue
    }

    if (existing.owner !== id) exitOnConflict(property, directory, existing)
  }

  logger.debug('Storage directories claimed by this process (id %s).', id)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function readStorageOwner (ownerPath: string): Promise<StorageOwner> {
  try {
    const content = await readFile(ownerPath, 'utf-8')
    const parsed = JSON.parse(content) as StorageOwner

    return parsed?.owner
      ? parsed
      : undefined
  } catch {
    // Not claimed yet, or a file we did not write: claim it
    return undefined
  }
}

function exitOnConflict (property: string, directory: string, existing: StorageOwner): never {
  const settingName = 'storage.' + (SETTING_NAMES[property] || property.toLowerCase())

  logger.error(
    `Cannot start PeerTube: "${directory}" (${settingName}) already belongs to another PeerTube process, ` +
      `which claimed it on ${existing.claimedAt}.\n` +
      'Every process of the same PeerTube instance needs storage directories of its own. ' +
      `Set ${settingName} to a directory this process does not share with the others.\n` +
      `If you moved that directory from one process to another on purpose, delete its ` +
      `${STORAGE_OWNER_FILE_NAME} file and start PeerTube again.`
  )

  process.exit(-1)
}
