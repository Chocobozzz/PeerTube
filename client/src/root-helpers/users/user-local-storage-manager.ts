import { NSFWPolicyType, UserRole } from '@shared/models'
import { peertubeLocalStorage } from '../peertube-web-storage'
import { UserLocalStorageKeys } from './user-local-storage-keys'

function getUserInfoFromLocalStorage () {
  const usernameLocalStorage = peertubeLocalStorage.getItem(UserLocalStorageKeys.USERNAME)

  if (!usernameLocalStorage) return undefined

  return {
    id: parseInt(peertubeLocalStorage.getItem(UserLocalStorageKeys.ID), 10),
    username: peertubeLocalStorage.getItem(UserLocalStorageKeys.USERNAME),
    email: peertubeLocalStorage.getItem(UserLocalStorageKeys.EMAIL),
    role: parseInt(peertubeLocalStorage.getItem(UserLocalStorageKeys.ROLE), 10) as UserRole,
    nsfwPolicy: peertubeLocalStorage.getItem(UserLocalStorageKeys.NSFW_POLICY) as NSFWPolicyType,
    webTorrentEnabled: peertubeLocalStorage.getItem(UserLocalStorageKeys.WEBTORRENT_ENABLED) === 'true',
    autoPlayVideo: peertubeLocalStorage.getItem(UserLocalStorageKeys.AUTO_PLAY_VIDEO) === 'true',
    videosHistoryEnabled: peertubeLocalStorage.getItem(UserLocalStorageKeys.VIDEOS_HISTORY_ENABLED) === 'true'
  }
}

function flushUserInfoFromLocalStorage () {
  peertubeLocalStorage.removeItem(UserLocalStorageKeys.ID)
  peertubeLocalStorage.removeItem(UserLocalStorageKeys.USERNAME)
  peertubeLocalStorage.removeItem(UserLocalStorageKeys.EMAIL)
  peertubeLocalStorage.removeItem(UserLocalStorageKeys.ROLE)
  peertubeLocalStorage.removeItem(UserLocalStorageKeys.NSFW_POLICY)
  peertubeLocalStorage.removeItem(UserLocalStorageKeys.WEBTORRENT_ENABLED)
  peertubeLocalStorage.removeItem(UserLocalStorageKeys.AUTO_PLAY_VIDEO)
  peertubeLocalStorage.removeItem(UserLocalStorageKeys.VIDEOS_HISTORY_ENABLED)
}

function saveUserInfoIntoLocalStorage (info: {
  id: number
  username: string
  email: string
  role: UserRole
  nsfwPolicy: NSFWPolicyType
  webTorrentEnabled: boolean
  autoPlayVideo: boolean
}) {
  peertubeLocalStorage.setItem(UserLocalStorageKeys.ID, info.id.toString())
  peertubeLocalStorage.setItem(UserLocalStorageKeys.USERNAME, info.username)
  peertubeLocalStorage.setItem(UserLocalStorageKeys.EMAIL, info.email)
  peertubeLocalStorage.setItem(UserLocalStorageKeys.ROLE, info.role.toString())
  peertubeLocalStorage.setItem(UserLocalStorageKeys.NSFW_POLICY, info.nsfwPolicy.toString())
  peertubeLocalStorage.setItem(UserLocalStorageKeys.WEBTORRENT_ENABLED, JSON.stringify(info.webTorrentEnabled))
  peertubeLocalStorage.setItem(UserLocalStorageKeys.AUTO_PLAY_VIDEO, JSON.stringify(info.autoPlayVideo))
}

export {
  getUserInfoFromLocalStorage,
  saveUserInfoIntoLocalStorage,
  flushUserInfoFromLocalStorage
}
