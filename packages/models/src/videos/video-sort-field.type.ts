// dprint-ignore-file

export type VideoSortField =
  'name' | '-name' |
  'duration' | '-duration' |
  'publishedAt' | '-publishedAt' |
  'originallyPublishedAt' | '-originallyPublishedAt' |
  'createdAt' | '-createdAt' |
  'views' | '-views' |
  'likes' | '-likes' |
  'comments' | '-comments' |

  'match' | '-match' |

  'localVideoFilesSize' | '-localVideoFilesSize' |

  // trending sorts
  'trending' | '-trending' |
  'hot' | '-hot' |
  'best' | '-best'
