import { getValue, removeValue, setValue } from './redis-client.js'

const YOUTUBE_DL_COOKIES_KEY = 'youtube-dl-cookies'

// The yt-dlp cookies file of the primary process, encrypted, so secondaries on another host can use it too
export function setYoutubeDLCookies (encrypted: string) {
  return setValue(YOUTUBE_DL_COOKIES_KEY, encrypted)
}

export function getYoutubeDLCookies () {
  return getValue(YOUTUBE_DL_COOKIES_KEY)
}

export function deleteYoutubeDLCookies () {
  return removeValue(YOUTUBE_DL_COOKIES_KEY)
}
