export const AbusePredefinedReasons = {
  VIOLENT_OR_REPULSIVE: 1,
  HATEFUL_OR_ABUSIVE: 2,
  SPAM_OR_MISLEADING: 3,
  PRIVACY: 4,
  RIGHTS: 5,
  SERVER_RULES: 6,
  THUMBNAILS: 7,
  CAPTIONS: 8
} as const

export type AbusePredefinedReasonsType = typeof AbusePredefinedReasons[keyof typeof AbusePredefinedReasons]

export type AbusePredefinedReasonsString =
  'violentOrRepulsive' |
  'hatefulOrAbusive' |
  'spamOrMisleading' |
  'privacy' |
  'rights' |
  'serverRules' |
  'thumbnails' |
  'captions'
