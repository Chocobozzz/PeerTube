import { addToSet, deleteFromSet, deleteKey, getSet, getValue, increment, StatKind } from './redis-client.js'

export function incrementLocalVideoStatCounter (kind: StatKind, videoId: number) {
  const { videoKey, setKey } = generateLocalVideoStatCounterKeys(kind, videoId)

  return Promise.all([
    addToSet(setKey, videoId.toString()),
    increment(videoKey)
  ])
}

export async function getLocalVideoStatCounters (kind: StatKind, videoId: number) {
  const { videoKey } = generateLocalVideoStatCounterKeys(kind, videoId)

  const valueString = await getValue(videoKey)
  const valueInt = parseInt(valueString, 10)

  if (isNaN(valueInt)) return undefined

  return valueInt
}

export async function listLocalVideoIdsWithStatCounters () {
  const { setKey } = generateLocalVideoStatCounterKeys()

  return (await getSet(setKey)).map(s => parseInt(s, 10))
}

export async function deleteLocalVideoStatCounters (videoId: number) {
  for (const kind of ([ 'views', 'downloads' ] as StatKind[])) {
    const { setKey, videoKey } = generateLocalVideoStatCounterKeys(kind, videoId)

    await Promise.all([
      deleteFromSet(setKey, videoId.toString()),
      deleteKey(videoKey)
    ])
  }
}

// ---------------------------------------------------------------------------

function generateLocalVideoStatCounterKeys (type: StatKind, videoId: number): { setKey: string, videoKey: string }
function generateLocalVideoStatCounterKeys (): { setKey: string }
function generateLocalVideoStatCounterKeys (type?: StatKind, videoId?: number) {
  const setKey = `local-video-stats-buffer`
  if (!type || !videoId) return { setKey }

  const videoKey = `local-video-${type}-buffer-${videoId}`

  return { setKey, videoKey }
}
