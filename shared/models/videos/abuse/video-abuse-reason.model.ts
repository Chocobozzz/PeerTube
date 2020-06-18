export enum VideoAbusePredefinedReasons {
  VIOLENT_OR_REPULSIVE,
  HATEFUL_OR_ABUSIVE,
  SPAM_OR_MISLEADING,
  PRIVACY,
  RIGHTS,
  SERVER_RULES,
  THUMBNAILS,
  CAPTIONS
}

export type VideoAbusePredefinedReasonsIn =
  'violentOrRepulsive' |
  'hatefulOrAbusive' |
  'spamOrMisleading' |
  'privacy' |
  'rights' |
  'serverRules' |
  'thumbnails' |
  'captions'

export const VideoAbusePredefinedReasonsIn = {
  violentOrRepulsive: VideoAbusePredefinedReasons.VIOLENT_OR_REPULSIVE,
  hatefulOrAbusive: VideoAbusePredefinedReasons.HATEFUL_OR_ABUSIVE,
  spamOrMisleading: VideoAbusePredefinedReasons.SPAM_OR_MISLEADING,
  privacy: VideoAbusePredefinedReasons.PRIVACY,
  rights: VideoAbusePredefinedReasons.RIGHTS,
  serverRules: VideoAbusePredefinedReasons.SERVER_RULES,
  thumbnails: VideoAbusePredefinedReasons.THUMBNAILS,
  captions: VideoAbusePredefinedReasons.CAPTIONS
}
