import { ActivityType } from '@shared/models'

function getAPId (object: string | { id: string }) {
  if (typeof object === 'string') return object

  return object.id
}

function getActivityStreamDuration (duration: number) {
  // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-duration
  return 'PT' + duration + 'S'
}

function getDurationFromActivityStream (duration: string) {
  return parseInt(duration.replace(/[^\d]+/, ''))
}

function buildAvailableActivities (): ActivityType[] {
  return [
    'Create',
    'Update',
    'Delete',
    'Follow',
    'Accept',
    'Announce',
    'Undo',
    'Like',
    'Reject',
    'View',
    'Dislike',
    'Flag'
  ]
}

export {
  getAPId,
  getActivityStreamDuration,
  buildAvailableActivities,
  getDurationFromActivityStream
}
