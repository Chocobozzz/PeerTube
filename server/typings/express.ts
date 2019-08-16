import { VideoChannelModel } from '../models/video/video-channel'
import { VideoPlaylistModel } from '../models/video/video-playlist'
import { VideoPlaylistElementModel } from '../models/video/video-playlist-element'
import { UserModel } from '../models/account/user'
import { VideoModel } from '../models/video/video'
import { AccountModel } from '../models/account/account'
import { VideoChangeOwnershipModel } from '../models/video/video-change-ownership'
import { ActorModel } from '../models/activitypub/actor'
import { VideoCommentModel } from '../models/video/video-comment'
import { VideoShareModel } from '../models/video/video-share'
import { AccountVideoRateModel } from '../models/account/account-video-rate'
import { ActorFollowModel } from '../models/activitypub/actor-follow'
import { ServerModel } from '../models/server/server'
import { VideoFileModel } from '../models/video/video-file'
import { VideoRedundancyModel } from '../models/redundancy/video-redundancy'
import { ServerBlocklistModel } from '../models/server/server-blocklist'
import { AccountBlocklistModel } from '../models/account/account-blocklist'
import { VideoImportModel } from '../models/video/video-import'
import { VideoAbuseModel } from '../models/video/video-abuse'
import { VideoBlacklistModel } from '../models/video/video-blacklist'
import { VideoCaptionModel } from '../models/video/video-caption'
import { VideoStreamingPlaylistModel } from '../models/video/video-streaming-playlist'
import { RegisteredPlugin } from '../lib/plugins/plugin-manager'
import { PluginModel } from '../models/server/plugin'
import { SignatureActorModel } from './models'

declare module 'express' {

  interface Response {
    locals: {
      video?: VideoModel
      videoShare?: VideoShareModel
      videoFile?: VideoFileModel

      videoImport?: VideoImportModel

      videoBlacklist?: VideoBlacklistModel

      videoCaption?: VideoCaptionModel

      videoAbuse?: VideoAbuseModel

      videoStreamingPlaylist?: VideoStreamingPlaylistModel

      videoChannel?: VideoChannelModel

      videoPlaylist?: VideoPlaylistModel
      videoPlaylistElement?: VideoPlaylistElementModel

      accountVideoRate?: AccountVideoRateModel

      videoComment?: VideoCommentModel
      videoCommentThread?: VideoCommentModel

      follow?: ActorFollowModel
      subscription?: ActorFollowModel

      nextOwner?: AccountModel
      videoChangeOwnership?: VideoChangeOwnershipModel
      account?: AccountModel
      actor?: ActorModel
      user?: UserModel

      server?: ServerModel

      videoRedundancy?: VideoRedundancyModel

      accountBlock?: AccountBlocklistModel
      serverBlock?: ServerBlocklistModel

      oauth?: {
        token: {
          User: UserModel
          user: UserModel
        }
      }

      signature?: {
        actor: SignatureActorModel
      }

      authenticated?: boolean

      registeredPlugin?: RegisteredPlugin

      plugin?: PluginModel
    }
  }
}
