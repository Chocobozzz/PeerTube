import { isActivityPubUrlValid, isBaseActivityValid } from './misc'

function isLikeActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Like') &&
    isActivityPubUrlValid(activity.object)
}

function isDislikeActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Create') &&
    activity.object.type === 'Dislike' &&
    isActivityPubUrlValid(activity.object.actor) &&
    isActivityPubUrlValid(activity.object.object)
}

// ---------------------------------------------------------------------------

export {
  isLikeActivityValid,
  isDislikeActivityValid
}
