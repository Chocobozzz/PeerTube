import { canVideoFileBeEdited } from '@peertube/peertube-core-utils'
import { VideoState, VideoStateType } from '@peertube/peertube-models'

export function getReplaceFileUnavailability (options: {
  isLive: boolean
  replaceFileEnabled: boolean
  state: VideoStateType
  instanceName: string
}) {
  const { isLive, replaceFileEnabled, state, instanceName } = options

  if (!replaceFileEnabled) return $localize`File replacement is not enabled on ${instanceName}.`

  if (!canVideoFileBeEdited(state)) {
    if (isLive) return $localize`File replacement is not available on a live.`
    if (state === VideoState.TO_TRANSCODE) return $localize`File replacement is not available while the video is being transcoded.`
    if (state === VideoState.TO_EDIT) return $localize`File replacement is not available while the video is being edited.`

    if (state === VideoState.TO_IMPORT || state === VideoState.TO_IMPORT_FAILED) {
      return $localize`File replacement is not available while the video is being imported.`
    }

    return $localize`File replacement is not available.`
  }

  return ''
}

export function getStudioUnavailability (options: {
  isLive: boolean
  studioEnabled: boolean
  state: VideoStateType
  instanceName: string
}) {
  const { isLive, studioEnabled, state, instanceName } = options

  if (!studioEnabled) return $localize`Studio is not enabled on ${instanceName}.`

  if (!canVideoFileBeEdited(state)) {
    if (isLive) return $localize`Studio is not available on a live.`
    if (state === VideoState.TO_TRANSCODE) return $localize`Studio is not available while the video is being transcoded.`
    if (state === VideoState.TO_EDIT) return $localize`Studio is not available while the video is being edited.`

    if (state === VideoState.TO_IMPORT || state === VideoState.TO_IMPORT_FAILED) {
      return $localize`Studio is not available while the video is being imported.`
    }

    return $localize`Studio is not available.`
  }

  return ''
}
