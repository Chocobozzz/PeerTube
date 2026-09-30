import { hostname } from 'os'
import { resolve } from 'path'
import { CONFIG } from './config.js'
import { getPrimaryProcessStorage } from './config/shared-config.js'

/**
 * Two PeerTube processes must never share a storage directory because of potential conflicts (tmp is cleaned at every boot...)
 * Secondary processes never use the files of the primary process on the file system: they must be in object storage
 */

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

// Resolved storage directories of this process, keyed by setting name without the "storage." prefix (tmp, avatars, web_videos...)
export function buildStorageDirectoriesPayload () {
  const result: Record<string, string> = {}

  for (const property of Object.keys(SETTING_NAMES)) {
    result[SETTING_NAMES[property]] = resolve(CONFIG.STORAGE[property])
  }

  return result
}

export function findStorageDirectoriesConflictsWithPrimary () {
  const primary = getPrimaryProcessStorage()
  if (!primary?.storage || primary.hostname !== hostname()) return []

  const local = buildStorageDirectoriesPayload()

  return Object.entries(local)
    .filter(([ settingName, path ]) => primary.storage[settingName] === path)
    .map(([ settingName ]) => 'storage.' + settingName)
}
