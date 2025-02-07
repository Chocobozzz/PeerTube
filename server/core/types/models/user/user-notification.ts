import { VideoAbuseModel } from '@server/models/abuse/video-abuse.js'
import { VideoCommentAbuseModel } from '@server/models/abuse/video-comment-abuse.js'
import { ApplicationModel } from '@server/models/application/application.js'
import { PluginModel } from '@server/models/server/plugin.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserRegistrationModel } from '@server/models/user/user-registration.js'
import { PickWith, PickWithOpt } from '@peertube/peertube-typescript-utils'
import { AbuseModel } from '../../../models/abuse/abuse.js'
import { AccountModel } from '../../../models/account/account.js'
import { ActorModel } from '../../../models/actor/actor.js'
import { ActorFollowModel } from '../../../models/actor/actor-follow.js'
import { ActorImageModel } from '../../../models/actor/actor-image.js'
import { ServerModel } from '../../../models/server/server.js'
import { VideoModel } from '../../../models/video/video.js'
import { VideoBlacklistModel } from '../../../models/video/video-blacklist.js'
import { VideoChannelModel } from '../../../models/video/video-channel.js'
import { VideoCommentModel } from '../../../models/video/video-comment.js'
import { VideoImportModel } from '../../../models/video/video-import.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'

type Use<K extends keyof UserNotificationModel, M> = PickWith<UserNotificationModel, K, M>

// ############################################################################

export module UserNotificationIncludes {
  export type ActorImageInclude = Pick<ActorImageModel, 'createdAt' | 'filename' | 'type' | 'getStaticPath' | 'width' | 'updatedAt'>

  export type VideoInclude = Pick<VideoModel, 'id' | 'uuid' | 'name' | 'state'>
  export type VideoIncludeChannel =
    VideoInclude &
    PickWith<VideoModel, 'VideoChannel', VideoChannelIncludeActor>

  export type ActorInclude =
    Pick<ActorModel, 'preferredUsername' | 'getHost'> &
    PickWith<ActorModel, 'Avatars', ActorImageInclude[]> &
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
    Pick<VideoCommentModel, 'id' | 'originCommentId' | 'getThreadId' | 'heldForReview'> &
    PickWith<VideoCommentModel, 'Account', AccountIncludeActor> &
    PickWith<VideoCommentModel, 'Video', VideoInclude>

  export type VideoAbuseInclude =
    Pick<VideoAbuseModel, 'id'> &
    PickWith<VideoAbuseModel, 'Video', VideoInclude>

  export type VideoCommentAbuseInclude =
    Pick<VideoCommentAbuseModel, 'id'> &
    PickWith<VideoCommentAbuseModel, 'VideoComment',
    Pick<VideoCommentModel, 'id' | 'originCommentId' | 'getThreadId'> &
    PickWith<VideoCommentModel, 'Video', Pick<VideoModel, 'id' | 'name' | 'uuid' | 'state'>>>

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
    PickWithOpt<ActorModel, 'Avatars', ActorImageInclude[]>

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

  export type UserRegistrationInclude =
    Pick<UserRegistrationModel, 'id' | 'username'>

  export type VideoCaptionInclude =
    Pick<VideoCaptionModel, 'id' | 'language'> &
    PickWith<VideoCaptionModel, 'Video', VideoInclude>
}

// ############################################################################

export type MUserNotification =
  Omit<UserNotificationModel, 'User' | 'Video' | 'VideoComment' | 'Abuse' | 'VideoBlacklist' |
  'VideoImport' | 'Account' | 'ActorFollow' | 'Plugin' | 'Application' | 'UserRegistration' | 'VideoCaption'>

// ############################################################################

export type UserNotificationModelForApi =
  MUserNotification &
  Use<'Video', UserNotificationIncludes.VideoIncludeChannel> &
  Use<'VideoComment', UserNotificationIncludes.VideoCommentInclude> &
  Use<'Abuse', UserNotificationIncludes.AbuseInclude> &
  Use<'VideoBlacklist', UserNotificationIncludes.VideoBlacklistInclude> &
  Use<'VideoImport', UserNotificationIncludes.VideoImportInclude> &
  Use<'ActorFollow', UserNotificationIncludes.ActorFollowInclude> &
  Use<'Plugin', UserNotificationIncludes.PluginInclude> &
  Use<'Application', UserNotificationIncludes.ApplicationInclude> &
  Use<'Account', UserNotificationIncludes.AccountIncludeActor> &
  Use<'UserRegistration', UserNotificationIncludes.UserRegistrationInclude> &
  Use<'VideoCaption', UserNotificationIncludes.VideoCaptionInclude>
