import { createLogger } from '../../helpers/logger.js'
import { deleteFromSet, deleteHashFields, deleteKey, getHash, getSet, runAddVideoViewerCounter, setHashField } from './redis-client.js'

const logger = createLogger('redis')

// Holds the total of the video in the hash of its viewers, and can therefore not be a viewer id
// Keep it in sync with the `TOTAL` field of lua/add-video-viewer-counter.lua
const VIDEO_VIEWER_COUNTER_TOTAL_FIELD = 'TOTAL'

export type AddVideoViewerCounterOptions = {
  videoId: number
  viewerId: string

  expires: number

  viewerScope: string
  videoScope: string

  viewerCount: number

  now: number

  // Date before which the viewer must be federated again, or 0 to never federate it
  federateBefore: number
  replaceCurrentViewers?: boolean
}

export async function listVideoIdsWithViewers () {
  const { setKey } = generateVideoViewerCounterKeys()

  const stringIds = await getSet(setKey)

  return stringIds.map(s => parseInt(s, 10))
}

export async function listVideoViewerCounters<T> (videoId: number) {
  const { videoKey } = generateVideoViewerCounterKeys(videoId)

  const hash = await getHash(videoKey)
  const result: { [viewerId: string]: T } = {}

  for (const [ viewerId, value ] of Object.entries(hash || {})) {
    if (viewerId === VIDEO_VIEWER_COUNTER_TOTAL_FIELD) continue

    try {
      result[viewerId] = JSON.parse(value)
    } catch (err) {
      logger.warn('Cannot parse Redis viewer counter %s of video %d.', viewerId, videoId, { err })
    }
  }

  return result
}

// See lua/add-video-viewer-counter.lua: the whole decision is made atomically in Redis
export async function addVideoViewerCounter (options: AddVideoViewerCounterOptions) {
  const { videoId, viewerId, expires, viewerScope, videoScope, viewerCount, now, federateBefore } = options

  const { setKey, videoKey } = generateVideoViewerCounterKeys(videoId)

  const [ isNew, mustFederate, totalViewers ] = await runAddVideoViewerCounter({
    videoKey,
    setKey,
    args: [
      videoId,
      viewerId,
      expires,
      viewerScope,
      videoScope,
      viewerCount,
      now,
      federateBefore,
      options.replaceCurrentViewers
        ? '1'
        : ''
    ]
  })

  return { isNew: isNew === 1, mustFederate: mustFederate === 1, totalViewers }
}

export async function deleteVideoViewerCounters (videoId: number, viewerIds: string[], newTotal: number) {
  if (viewerIds.length === 0) return

  const { videoKey } = generateVideoViewerCounterKeys(videoId)

  await Promise.all([
    deleteHashFields(videoKey, viewerIds),

    // Update "total" in Redis
    setVideoViewerCounterTotal(videoId, newTotal)
  ])
}

export async function deleteAllVideoViewerCounters (videoId: number) {
  const { setKey, videoKey } = generateVideoViewerCounterKeys(videoId)

  await Promise.all([
    deleteFromSet(setKey, videoId.toString()),

    // Removes the "total" field with the viewers. Setting it to 0 instead would race with this delete and
    // leave a hash nothing can clean up any more, since the video id is no longer in the set
    deleteKey(videoKey)
  ])
}

// ---------------------------------------------------------------------------

function generateVideoViewerCounterKeys (videoId: number): { setKey: string, videoKey: string }
function generateVideoViewerCounterKeys (): { setKey: string }
function generateVideoViewerCounterKeys (videoId?: number) {
  const setKey = `video-viewer-counters`
  if (!videoId) return { setKey }

  return { setKey, videoKey: `video-viewer-counters-${videoId}` }
}

async function setVideoViewerCounterTotal (videoId: number, total: number) {
  const { videoKey } = generateVideoViewerCounterKeys(videoId)

  await setHashField(videoKey, VIDEO_VIEWER_COUNTER_TOTAL_FIELD, total)
}
