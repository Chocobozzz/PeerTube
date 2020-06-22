export enum VideoAbusePredefinedReasons {
  VIOLENT_OR_REPULSIVE = 1,
  HATEFUL_OR_ABUSIVE,
  SPAM_OR_MISLEADING,
  PRIVACY,
  RIGHTS,
  SERVER_RULES,
  THUMBNAILS,
  CAPTIONS
}

export type VideoAbusePredefinedReasonsString =
  'violentOrRepulsive' |
  'hatefulOrAbusive' |
  'spamOrMisleading' |
  'privacy' |
  'rights' |
  'serverRules' |
  'thumbnails' |
  'captions'

export const videoAbusePredefinedReasonsMap: {
  [key in VideoAbusePredefinedReasonsString]: VideoAbusePredefinedReasons
} = {
  violentOrRepulsive: VideoAbusePredefinedReasons.VIOLENT_OR_REPULSIVE,
  hatefulOrAbusive: VideoAbusePredefinedReasons.HATEFUL_OR_ABUSIVE,
  spamOrMisleading: VideoAbusePredefinedReasons.SPAM_OR_MISLEADING,
  privacy: VideoAbusePredefinedReasons.PRIVACY,
  rights: VideoAbusePredefinedReasons.RIGHTS,
  serverRules: VideoAbusePredefinedReasons.SERVER_RULES,
  thumbnails: VideoAbusePredefinedReasons.THUMBNAILS,
  captions: VideoAbusePredefinedReasons.CAPTIONS
}
