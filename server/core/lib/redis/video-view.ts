import { VIEW_LIFETIME } from '../../initializers/constants.js'
import { keyExists, setValue } from './redis-client.js'

export function setSessionIdVideoView (ip: string, videoUUID: string) {
  return setValue(generateSessionIdViewKey(ip, videoUUID), '1', VIEW_LIFETIME.VIEW)
}

export function doesVideoSessionIdViewExist (sessionId: string, videoUUID: string) {
  return keyExists(generateSessionIdViewKey(sessionId, videoUUID))
}

// Exported: also used as an in-memory LRU cache key by lib/stats/shared/video-counters.ts
export function generateSessionIdViewKey (sessionId: string, videoUUID: string) {
  return `views-${videoUUID}-${sessionId}`
}
