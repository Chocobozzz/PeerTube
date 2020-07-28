import { RegisterServerAuthExternalOptions } from '@server/types'
import {
  MAbuseMessage,
  MAbuseReporter,
  MAccountBlocklist,
  MActorUrl,
  MStreamingPlaylist,
  MVideoChangeOwnershipFull,
  MVideoFile,
  MVideoImmutable,
  MVideoPlaylistFull,
  MVideoPlaylistFullSummary
} from '@server/types/models'
import { MOAuthTokenUser } from '@server/types/models/oauth/oauth-token'
import { MPlugin, MServer, MServerBlocklist } from '@server/types/models/server'
import { MVideoImportDefault } from '@server/types/models/video/video-import'
import { MVideoPlaylistElement, MVideoPlaylistElementVideoUrlPlaylistPrivacy } from '@server/types/models/video/video-playlist-element'
import { MAccountVideoRateAccountVideo } from '@server/types/models/video/video-rate'
import { UserRole } from '@shared/models'
import { RegisteredPlugin } from '../../lib/plugins/plugin-manager'
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
  MVideoBlacklist,
  MVideoCaptionVideo,
  MVideoFullLight,
  MVideoIdThumbnail,
  MVideoRedundancyVideo,
  MVideoShareActor,
  MVideoThumbnail,
  MVideoWithRights
} from '../../types/models'

declare module 'express' {
  export interface Request {
    query: any
  }

  interface Response {

    locals: {
      bypassLogin?: {
        bypass: boolean
        pluginName: string
        authName?: string
        user: {
          username: string
          email: string
          displayName: string
          role: UserRole
        }
      }

      refreshTokenAuthName?: string

      explicitLogout: boolean

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

      abuse?: MAbuseReporter
      abuseMessage?: MAbuseMessage

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

      externalAuth?: RegisterServerAuthExternalOptions

      plugin?: MPlugin
    }
  }
}
