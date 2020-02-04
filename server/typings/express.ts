import { RegisteredPlugin } from '../lib/plugins/plugin-manager'
import {
  MAccountDefault,
  MActorAccountChannelId,
  MActorFollowActorsDefault,
  MActorFollowActorsDefaultSubscription,
  MActorFull,
  MChannelAccountDefault,
  MComment,
  MCommentOwnerVideoReply,
  MUserDefault,
  MVideoAbuse,
  MVideoBlacklist,
  MVideoCaptionVideo,
  MVideoFullLight,
  MVideoIdThumbnail,
  MVideoRedundancyVideo,
  MVideoShareActor,
  MVideoThumbnail,
  MVideoWithRights
} from './models'
import { MVideoPlaylistFull, MVideoPlaylistFullSummary } from './models/video/video-playlist'
import { MVideoImportDefault } from '@server/typings/models/video/video-import'
import { MAccountBlocklist, MActorUrl, MStreamingPlaylist, MVideoFile, MVideoImmutable } from '@server/typings/models'
import { MVideoPlaylistElement, MVideoPlaylistElementVideoUrlPlaylistPrivacy } from '@server/typings/models/video/video-playlist-element'
import { MAccountVideoRateAccountVideo } from '@server/typings/models/video/video-rate'
import { MVideoChangeOwnershipFull } from './models/video/video-change-ownership'
import { MPlugin, MServer } from '@server/typings/models/server'
import { MServerBlocklist } from './models/server/server-blocklist'
import { MOAuthTokenUser } from '@server/typings/models/oauth/oauth-token'

declare module 'express' {

  interface Response {

    locals: {
      videoAll?: MVideoFullLight
      onlyImmutableVideo?: MVideoImmutable
      onlyVideo?: MVideoThumbnail
      onlyVideoWithRights?: MVideoWithRights
      videoId?: MVideoIdThumbnail

      videoShare?: MVideoShareActor

      videoFile?: MVideoFile

      videoImport?: MVideoImportDefault

      videoBlacklist?: MVideoBlacklist

      videoCaption?: MVideoCaptionVideo

      videoAbuse?: MVideoAbuse

      videoStreamingPlaylist?: MStreamingPlaylist

      videoChannel?: MChannelAccountDefault

      videoPlaylistFull?: MVideoPlaylistFull
      videoPlaylistSummary?: MVideoPlaylistFullSummary

      videoPlaylistElement?: MVideoPlaylistElement
      videoPlaylistElementAP?: MVideoPlaylistElementVideoUrlPlaylistPrivacy

      accountVideoRate?: MAccountVideoRateAccountVideo

      videoCommentFull?: MCommentOwnerVideoReply
      videoCommentThread?: MComment

      follow?: MActorFollowActorsDefault
      subscription?: MActorFollowActorsDefaultSubscription

      nextOwner?: MAccountDefault
      videoChangeOwnership?: MVideoChangeOwnershipFull

      account?: MAccountDefault

      actorUrl?: MActorUrl
      actorFull?: MActorFull

      user?: MUserDefault

      server?: MServer

      videoRedundancy?: MVideoRedundancyVideo

      accountBlock?: MAccountBlocklist
      serverBlock?: MServerBlocklist

      oauth?: {
        token: MOAuthTokenUser
      }

      signature?: {
        actor: MActorAccountChannelId
      }

      authenticated?: boolean

      registeredPlugin?: RegisteredPlugin

      plugin?: MPlugin
    }
  }
}
