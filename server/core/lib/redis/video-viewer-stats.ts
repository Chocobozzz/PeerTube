import { createLogger } from '../../helpers/logger.js'
import { deleteFromSet, deleteKey, getHash, getSet, runMergeLocalVideoViewer } from './redis-client.js'

const logger = createLogger('redis')

export type LocalVideoViewer = {
  firstUpdated: number // Date.getTime()
  lastUpdated: number // Date.getTime()

  watchSections: {
    start: number
    end: number
  }[]

  watchTime: number

  client: string
  device: string
  operatingSystem: string

  country: string
  subdivisionName: string

  videoId: number
}

export type MergeLocalVideoViewerOptions = {
  sessionId: string
  videoId: number

  now: number
  currentTime: number

  isSeek: boolean

  maxWatchSections: number

  // Only needed if the viewer does not exist yet, which the caller discovers from an 'unknown-viewer' result
  newViewer?: Record<string, string | number>
}

// Rebuilds the viewer stored by lua/merge-local-video-viewer.lua, closed watch sections first
export async function getLocalVideoViewer (options: { key: string }): Promise<LocalVideoViewer> {
  let hash: { [field: string]: string }

  try {
    hash = await getHash(options.key)
  } catch (err) {
    // A key left by a version that stored the viewer as JSON: the caller removes what it cannot read
    logger.warn('Cannot read viewer stats of Redis key %s.', options.key, { err })

    return null
  }

  if (!hash?.sectionStart) return null

  try {
    const watchSections: LocalVideoViewer['watchSections'] = []

    for (let i = 0; i < +hash.closedSections; i++) {
      const [ start, end ] = hash['s' + i].split(':')

      watchSections.push({ start: +start, end: +end })
    }

    watchSections.push({ start: +hash.sectionStart, end: +hash.sectionEnd })

    return {
      firstUpdated: +hash.firstUpdated,
      lastUpdated: +hash.lastUpdated,
      watchTime: +hash.watchTime,
      watchSections,

      client: hash.client || null,
      device: hash.device || null,
      operatingSystem: hash.operatingSystem || null,
      country: hash.country || null,
      subdivisionName: hash.subdivisionName || null,

      videoId: +hash.videoId
    }
  } catch (err) {
    logger.warn('Cannot rebuild viewer stats of Redis key %s.', options.key, { err })

    return null
  }
}

export async function mergeLocalVideoViewer (options: MergeLocalVideoViewerOptions) {
  const { sessionId, videoId, now, currentTime, isSeek, maxWatchSections, newViewer } = options

  const { setKey, viewerKey } = generateLocalVideoViewerKeys(sessionId, videoId)

  // Redis stores no null, and an empty field reads back as one
  const creationFields = newViewer
    ? Object.entries(newViewer).flatMap(([ field, value ]) => [ field, value ?? '' ])
    : []

  const [ status, watchTime ] = await runMergeLocalVideoViewer({
    viewerKey,
    setKey,
    args: [
      viewerKey,
      now,
      currentTime,
      isSeek ? '1' : '0',
      maxWatchSections,
      ...creationFields
    ]
  })

  if (status === -1) return { status: 'unknown-viewer' as const, watchTime }
  if (status === 0) return { status: 'too-many-watch-sections' as const, watchTime }

  return { status: 'merged' as const, watchTime }
}

export function listLocalVideoViewerKeys () {
  const { setKey } = generateLocalVideoViewerKeys()

  return getSet(setKey)
}

export function deleteLocalVideoViewersKeys (key: string) {
  const { setKey } = generateLocalVideoViewerKeys()

  return Promise.all([
    deleteFromSet(setKey, key),
    deleteKey(key)
  ])
}

// ---------------------------------------------------------------------------

function generateLocalVideoViewerKeys (sessionId: string, videoId: number): { setKey: string, viewerKey: string }
function generateLocalVideoViewerKeys (): { setKey: string }
function generateLocalVideoViewerKeys (sessionId?: string, videoId?: number) {
  return {
    setKey: `local-video-viewer-stats-keys`,

    viewerKey: sessionId && videoId
      ? `local-video-viewer-stats-${sessionId}-${videoId}`
      : undefined
  }
}
