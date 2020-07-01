export enum AbusePredefinedReasons {
  VIOLENT_OR_REPULSIVE = 1,
  HATEFUL_OR_ABUSIVE,
  SPAM_OR_MISLEADING,
  PRIVACY,
  RIGHTS,
  SERVER_RULES,
  THUMBNAILS,
  CAPTIONS
}

export type AbusePredefinedReasonsString =
  'violentOrRepulsive' |
  'hatefulOrAbusive' |
  'spamOrMisleading' |
  'privacy' |
  'rights' |
  'serverRules' |
  'thumbnails' |
  'captions'

export const abusePredefinedReasonsMap: {
  [key in AbusePredefinedReasonsString]: AbusePredefinedReasons
} = {
  violentOrRepulsive: AbusePredefinedReasons.VIOLENT_OR_REPULSIVE,
  hatefulOrAbusive: AbusePredefinedReasons.HATEFUL_OR_ABUSIVE,
  spamOrMisleading: AbusePredefinedReasons.SPAM_OR_MISLEADING,
  privacy: AbusePredefinedReasons.PRIVACY,
  rights: AbusePredefinedReasons.RIGHTS,
  serverRules: AbusePredefinedReasons.SERVER_RULES,
  thumbnails: AbusePredefinedReasons.THUMBNAILS,
  captions: AbusePredefinedReasons.CAPTIONS
}
