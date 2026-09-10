import { exists } from '../../helpers/custom-validators/misc.js'
import { addToSet, deleteFromSet, deleteKey, getSet, getValue, increment, StatKind } from './redis-client.js'

export function incrementVideoStatCounter (kind: StatKind, videoId: number) {
  const { videoKey, setKey } = generateVideoStatCounterKeys({ kind, videoId })

  return Promise.all([
    addToSet(setKey, videoId.toString()),
    increment(videoKey)
  ])
}

export async function getVideoStatCounters (kind: StatKind, videoId: number, hour: number) {
  const { videoKey } = generateVideoStatCounterKeys({ kind, videoId, hour })

  const valueString = await getValue(videoKey)
  const valueInt = parseInt(valueString, 10)

  if (isNaN(valueInt)) return undefined

  return valueInt
}

export async function listVideosStatCounters (hour: number) {
  const { setKey } = generateVideoStatCounterKeys({ hour })

  const stringIds = await getSet(setKey)
  return stringIds.map(s => parseInt(s, 10))
}

export async function deleteVideoStatCounters (videoId: number, hour: number) {
  for (const kind of ([ 'views', 'downloads' ] as StatKind[])) {
    const { setKey, videoKey } = generateVideoStatCounterKeys({ kind, videoId, hour })

    await Promise.all([
      deleteFromSet(setKey, videoId.toString()),
      deleteKey(videoKey)
    ])
  }
}

// ---------------------------------------------------------------------------

function generateVideoStatCounterKeys (options: { hour: number }): { setKey: string }
function generateVideoStatCounterKeys (options: { videoId: number, hour?: number, kind: StatKind }): { setKey: string, videoKey: string }
function generateVideoStatCounterKeys (options: { kind?: StatKind, videoId?: number, hour?: number }) {
  const hour = exists(options.hour)
    ? options.hour
    : new Date().getHours()

  if (!options.kind || !options.videoId) {
    return { setKey: `videos-stats-h${hour}` }
  }

  return { setKey: `videos-stats-h${hour}`, videoKey: `video-${options.kind}-${options.videoId}-h${hour}` }
}
