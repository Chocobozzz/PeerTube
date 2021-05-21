import { VideoAbuseModel } from '@server/models/abuse/video-abuse'
import { VideoCommentAbuseModel } from '@server/models/abuse/video-comment-abuse'
import { ApplicationModel } from '@server/models/application/application'
import { PluginModel } from '@server/models/server/plugin'
import { UserNotificationModel } from '@server/models/user/user-notification'
import { PickWith, PickWithOpt } from '@shared/core-utils'
import { AbuseModel } from '../../../models/abuse/abuse'
import { AccountModel } from '../../../models/account/account'
import { ActorModel } from '../../../models/actor/actor'
import { ActorFollowModel } from '../../../models/actor/actor-follow'
import { ActorImageModel } from '../../../models/actor/actor-image'
import { ServerModel } from '../../../models/server/server'
import { VideoModel } from '../../../models/video/video'
import { VideoBlacklistModel } from '../../../models/video/video-blacklist'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { VideoImportModel } from '../../../models/video/video-import'

type Use<K extends keyof UserNotificationModel, M> = PickWith<UserNotificationModel, K, M>

// ############################################################################

export module UserNotificationIncludes {

  export type VideoInclude = Pick<VideoModel, 'id' | 'uuid' | 'name'>
  export type VideoIncludeChannel =
    VideoInclude &
    PickWith<VideoModel, 'VideoChannel', VideoChannelIncludeActor>

  export type ActorInclude =
    Pick<ActorModel, 'preferredUsername' | 'getHost'> &
    PickWith<ActorModel, 'Avatar', Pick<ActorImageModel, 'filename' | 'getStaticPath'>> &
    PickWith<ActorModel, 'Server', Pick<ServerModel, 'host'>>

  export type VideoChannelInclude = Pick<VideoChannelModel, 'id' | 'name' | 'getDisplayName'>
  export type VideoChannelIncludeActor =
    VideoChannelInclude &
    PickWith<VideoChannelModel, 'Actor', ActorInclude>

  export type AccountInclude = Pick<AccountModel, 'id' | 'name' | 'getDisplayName'>
  export type AccountIncludeActor =
    AccountInclude &
    PickWith<AccountModel, 'Actor', ActorInclude>

  export type VideoCommentInclude =
    Pick<VideoCommentModel, 'id' | 'originCommentId' | 'getThreadId'> &
    PickWith<VideoCommentModel, 'Account', AccountIncludeActor> &
    PickWith<VideoCommentModel, 'Video', VideoInclude>

  export type VideoAbuseInclude =
    Pick<VideoAbuseModel, 'id'> &
    PickWith<VideoAbuseModel, 'Video', VideoInclude>

  export type VideoCommentAbuseInclude =
    Pick<VideoCommentAbuseModel, 'id'> &
    PickWith<VideoCommentAbuseModel, 'VideoComment',
    Pick<VideoCommentModel, 'id' | 'originCommentId' | 'getThreadId'> &
    PickWith<VideoCommentModel, 'Video', Pick<VideoModel, 'id' | 'name' | 'uuid'>>>

  export type AbuseInclude =
    Pick<AbuseModel, 'id' | 'state'> &
    PickWith<AbuseModel, 'VideoAbuse', VideoAbuseInclude> &
    PickWith<AbuseModel, 'VideoCommentAbuse', VideoCommentAbuseInclude> &
    PickWith<AbuseModel, 'FlaggedAccount', AccountIncludeActor>

  export type VideoBlacklistInclude =
    Pick<VideoBlacklistModel, 'id'> &
    PickWith<VideoAbuseModel, 'Video', VideoInclude>

  export type VideoImportInclude =
    Pick<VideoImportModel, 'id' | 'magnetUri' | 'targetUrl' | 'torrentName'> &
    PickWith<VideoImportModel, 'Video', VideoInclude>

  export type ActorFollower =
    Pick<ActorModel, 'preferredUsername' | 'getHost'> &
    PickWith<ActorModel, 'Account', AccountInclude> &
    PickWith<ActorModel, 'Server', Pick<ServerModel, 'host'>> &
    PickWithOpt<ActorModel, 'Avatar', Pick<ActorImageModel, 'filename' | 'getStaticPath'>>

  export type ActorFollowing =
    Pick<ActorModel, 'preferredUsername' | 'type' | 'getHost'> &
    PickWith<ActorModel, 'VideoChannel', VideoChannelInclude> &
    PickWith<ActorModel, 'Account', AccountInclude> &
    PickWith<ActorModel, 'Server', Pick<ServerModel, 'host'>>

  export type ActorFollowInclude =
    Pick<ActorFollowModel, 'id' | 'state'> &
    PickWith<ActorFollowModel, 'ActorFollower', ActorFollower> &
    PickWith<ActorFollowModel, 'ActorFollowing', ActorFollowing>

  export type PluginInclude =
    Pick<PluginModel, 'id' | 'name' | 'type' | 'latestVersion'>

  export type ApplicationInclude =
    Pick<ApplicationModel, 'latestPeerTubeVersion'>
}

// ############################################################################

export type MUserNotification =
  Omit<UserNotificationModel, 'User' | 'Video' | 'Comment' | 'Abuse' | 'VideoBlacklist' |
  'VideoImport' | 'Account' | 'ActorFollow' | 'Plugin' | 'Application'>

// ############################################################################

export type UserNotificationModelForApi =
  MUserNotification &
  Use<'Video', UserNotificationIncludes.VideoIncludeChannel> &
  Use<'Comment', UserNotificationIncludes.VideoCommentInclude> &
  Use<'Abuse', UserNotificationIncludes.AbuseInclude> &
  Use<'VideoBlacklist', UserNotificationIncludes.VideoBlacklistInclude> &
  Use<'VideoImport', UserNotificationIncludes.VideoImportInclude> &
  Use<'ActorFollow', UserNotificationIncludes.ActorFollowInclude> &
  Use<'Plugin', UserNotificationIncludes.PluginInclude> &
  Use<'Application', UserNotificationIncludes.ApplicationInclude> &
  Use<'Account', UserNotificationIncludes.AccountIncludeActor>
