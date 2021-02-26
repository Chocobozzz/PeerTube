import { isBaseActivityValid, isObjectValid } from './misc'

function isLikeActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Like') &&
    isObjectValid(activity.object)
}

function isDislikeActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Dislike') &&
    isObjectValid(activity.object)
}

// ---------------------------------------------------------------------------

export {
  isDislikeActivityValid,
  isLikeActivityValid
}
