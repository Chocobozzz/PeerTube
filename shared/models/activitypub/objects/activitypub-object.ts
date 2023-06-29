import { AbuseObject } from './abuse-object'
import { CacheFileObject } from './cache-file-object'
import { PlaylistObject } from './playlist-object'
import { VideoCommentObject } from './video-comment-object'
import { VideoObject } from './video-object'
import { WatchActionObject } from './watch-action-object'

export type ActivityObject =
  VideoObject |
  AbuseObject |
  VideoCommentObject |
  CacheFileObject |
  PlaylistObject |
  WatchActionObject |
  string

export type APObjectId = string | { id: string }
