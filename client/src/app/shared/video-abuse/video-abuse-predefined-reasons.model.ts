export enum PredefinedReasons {
  violentOrRepulsive = 'violentOrRepulsive',
  hatefulOrAbusive = 'hatefulOrAbusive',
  spamOrMisleading = 'spamOrMisleading',
  privacy = 'privacy',
  rights = 'rights',
  serverRules = 'serverRules',
  thumbnails = 'thumbnails',
  captions = 'captions'
}

export type VideoAbusePredefinedReasons = {
  [key in PredefinedReasons]?: boolean
}
