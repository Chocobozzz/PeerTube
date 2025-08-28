import { AbuseObject } from './abuse-object.js'
import { CacheFileObject } from './cache-file-object.js'
import { PlayerSettingsObject } from './player-settings-object.js'
import { PlaylistObject } from './playlist-object.js'
import { VideoCommentObject } from './video-comment-object.js'
import { VideoObject } from './video-object.js'
import { WatchActionObject } from './watch-action-object.js'

export type ActivityObject =
  | VideoObject
  | AbuseObject
  | VideoCommentObject
  | CacheFileObject
  | PlaylistObject
  | WatchActionObject
  | PlayerSettingsObject
  | string

export type APObjectId = string | { id: string }
