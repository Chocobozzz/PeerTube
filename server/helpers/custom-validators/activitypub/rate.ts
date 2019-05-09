import { isActivityPubUrlValid, isObjectValid } from './misc'

function isDislikeActivityValid (activity: any) {
  return activity.type === 'Dislike' &&
    isActivityPubUrlValid(activity.actor) &&
    isObjectValid(activity.object)
}

// ---------------------------------------------------------------------------

export {
  isDislikeActivityValid
}
