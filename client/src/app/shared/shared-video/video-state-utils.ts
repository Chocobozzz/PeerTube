import { VideoState, VideoStateType } from '@peertube/peertube-models'

export function getAllVideoStates () {
  return Object.values(VideoState) as VideoStateType[]
}

export function getVideoStateLabel (state: VideoStateType) {
  const states = {
    [VideoState.PUBLISHED]: $localize`Published`,
    [VideoState.TO_TRANSCODE]: $localize`To transcode`,
    [VideoState.TO_IMPORT]: $localize`To import`,
    [VideoState.TO_IMPORT_FAILED]: $localize`Import failed`,
    [VideoState.WAITING_FOR_LIVE]: $localize`Waiting live`,
    [VideoState.LIVE_ENDED]: $localize`Live ended`,
    [VideoState.TRANSCODING_FAILED]: $localize`Transcoding failed`,
    [VideoState.TO_MOVE_TO_EXTERNAL_STORAGE]: $localize`Moving to external storage`,
    [VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED]: $localize`Move to external storage failed`,
    [VideoState.TO_EDIT]: $localize`To edit`,
    [VideoState.TO_MOVE_TO_FILE_SYSTEM]: $localize`Moving to file system`,
    [VideoState.TO_MOVE_TO_FILE_SYSTEM_FAILED]: $localize`Moving to file system failed`
  }

  return states[state] || ''
}

export function getVideoStateBadgeClass (state: VideoStateType) {
  const states: { [id in VideoStateType]: string } = {
    [VideoState.PUBLISHED]: 'badge-green',
    [VideoState.TO_TRANSCODE]: 'badge-brown',
    [VideoState.TO_IMPORT]: 'badge-brown',
    [VideoState.TO_IMPORT_FAILED]: 'badge-red',
    [VideoState.WAITING_FOR_LIVE]: 'badge-blue',
    [VideoState.LIVE_ENDED]: 'badge-green',
    [VideoState.TO_MOVE_TO_EXTERNAL_STORAGE]: 'badge-brown',
    [VideoState.TRANSCODING_FAILED]: 'badge-red',
    [VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED]: 'badge-red',
    [VideoState.TO_EDIT]: 'badge-brown',
    [VideoState.TO_MOVE_TO_FILE_SYSTEM]: 'badge-brown',
    [VideoState.TO_MOVE_TO_FILE_SYSTEM_FAILED]: 'badge-brown'
  }

  return states[state] || ''
}
