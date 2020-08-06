export const enum AbusePredefinedReasons {
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
