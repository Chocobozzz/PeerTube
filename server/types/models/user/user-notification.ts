import { UserNotificationModel } from '../../../models/account/user-notification'
import { PickWith, PickWithOpt } from '../../utils'
import { VideoModel } from '../../../models/video/video'
import { ActorModel } from '../../../models/activitypub/actor'
import { ServerModel } from '../../../models/server/server'
import { AvatarModel } from '../../../models/avatar/avatar'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { AccountModel } from '../../../models/account/account'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { VideoBlacklistModel } from '../../../models/video/video-blacklist'
import { VideoImportModel } from '../../../models/video/video-import'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'

type Use<K extends keyof UserNotificationModel, M> = PickWith<UserNotificationModel, K, M>

// ############################################################################

export module UserNotificationIncludes {

  export type VideoInclude = Pick<VideoModel, 'id' | 'uuid' | 'name'>
  export type VideoIncludeChannel =
    VideoInclude &
    PickWith<VideoModel, 'VideoChannel', VideoChannelIncludeActor>

  export type ActorInclude =
    Pick<ActorModel, 'preferredUsername' | 'getHost'> &
    PickWith<ActorModel, 'Avatar', Pick<AvatarModel, 'filename' | 'getStaticPath'>> &
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
    PickWithOpt<ActorModel, 'Avatar', Pick<AvatarModel, 'filename' | 'getStaticPath'>>

  export type ActorFollowing =
    Pick<ActorModel, 'preferredUsername' | 'type' | 'getHost'> &
    PickWith<ActorModel, 'VideoChannel', VideoChannelInclude> &
    PickWith<ActorModel, 'Account', AccountInclude> &
    PickWith<ActorModel, 'Server', Pick<ServerModel, 'host'>>

  export type ActorFollowInclude =
    Pick<ActorFollowModel, 'id' | 'state'> &
    PickWith<ActorFollowModel, 'ActorFollower', ActorFollower> &
    PickWith<ActorFollowModel, 'ActorFollowing', ActorFollowing>
}

// ############################################################################

export type MUserNotification =
  Omit<UserNotificationModel, 'User' | 'Video' | 'Comment' | 'VideoAbuse' | 'VideoBlacklist' |
  'VideoImport' | 'Account' | 'ActorFollow'>

// ############################################################################

export type UserNotificationModelForApi =
  MUserNotification &
  Use<'Video', UserNotificationIncludes.VideoIncludeChannel> &
  Use<'Comment', UserNotificationIncludes.VideoCommentInclude> &
  Use<'VideoAbuse', UserNotificationIncludes.VideoAbuseInclude> &
  Use<'VideoBlacklist', UserNotificationIncludes.VideoBlacklistInclude> &
  Use<'VideoImport', UserNotificationIncludes.VideoImportInclude> &
  Use<'ActorFollow', UserNotificationIncludes.ActorFollowInclude> &
  Use<'Account', UserNotificationIncludes.AccountIncludeActor>
