import { CONFIG } from './config.js'
import { getSharedPrimaryStorage } from './config/shared-config.js'

/**
 * Two PeerTube processes must never share a working directory (tmp, plugins...) because of potential conflicts.
 * The directories of the files referenced by the database (video files, etc.) can only be shared by the processes of the same platform,
 * so secondary processes can manage these files too.
 *
 * A secondary process on the same host as the primary adopts the primary's shareable directories at boot.
 * It refuses to start if any of the directories it keeps for itself (tmp, plugins...) collides with one of the primary's directories.
 */

// Directories of the files referenced by the database, that a secondary process on the same host as the primary can share
export const SHAREABLE_STORAGE_DIRECTORIES = [
  'ACTOR_IMAGES_DIR',
  'WEB_VIDEOS_DIR',
  'STREAMING_PLAYLISTS_DIR',
  'ORIGINAL_VIDEO_FILES_DIR',
  'THUMBNAILS_DIR',
  'STORYBOARDS_DIR',
  'PREVIEWS_DIR',
  'CAPTIONS_DIR',
  'TORRENTS_DIR',
  'UPLOADS_DIR',
  'TMP_PERSISTENT_DIR'
] as const satisfies (keyof typeof CONFIG.STORAGE)[]

export type ShareableStorageDirectory = typeof SHAREABLE_STORAGE_DIRECTORIES[number]

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

export function getStorageDirectorySettingName (property: keyof typeof CONFIG.STORAGE) {
  return 'storage.' + getStorageDirectorySubSettingName(property)
}

export function getStorageDirectorySubSettingName (property: keyof typeof CONFIG.STORAGE) {
  return SETTING_NAMES[property] || property.toLowerCase()
}

export function getNotSharedStorageDirectories (
  directories: readonly ShareableStorageDirectory[] = SHAREABLE_STORAGE_DIRECTORIES
): ShareableStorageDirectory[] {
  const primaryStorage = getSharedPrimaryStorage()

  // Not on the same host as the primary: none of them are shared
  if (!primaryStorage) return [ ...directories ]

  return directories.filter(property => {
    const settingName = SETTING_NAMES[property] || property.toLowerCase()

    return primaryStorage[settingName] !== CONFIG.STORAGE[property]
  })
}
