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

export {
  getAPId,
  getActivityStreamDuration,
  getDurationFromActivityStream
}
