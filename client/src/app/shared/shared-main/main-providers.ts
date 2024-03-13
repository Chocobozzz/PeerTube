import { DatePipe } from '@angular/common'
import { AccountService } from './account/account.service'
import { FromNowPipe } from './angular/from-now.pipe'
import { UserHistoryService } from './users/user-history.service'
import { UserNotificationService } from './users/user-notification.service'
import { AUTH_INTERCEPTOR_PROVIDER } from './auth/auth-interceptor.service'
import { CustomPageService } from './custom-page/custom-page.service'
import { InstanceService } from './instance/instance.service'
import { ActorRedirectGuard } from './router/actor-redirect-guard.service'
import { VideoCaptionService } from './video-caption/video-caption.service'
import { VideoChannelService } from './video-channel/video-channel.service'
import { RedundancyService } from './video/redundancy.service'
import { VideoChapterService } from './video/video-chapter.service'
import { VideoFileTokenService } from './video/video-file-token.service'
import { VideoImportService } from './video/video-import.service'
import { VideoOwnershipService } from './video/video-ownership.service'
import { VideoPasswordService } from './video/video-password.service'
import { VideoResolver } from './video/video.resolver'
import { VideoService } from './video/video.service'

export function getMainProviders () {
  return [
    DatePipe,
    FromNowPipe,
    AUTH_INTERCEPTOR_PROVIDER,
    AccountService,
    UserHistoryService,
    UserNotificationService,
    RedundancyService,
    VideoImportService,
    VideoOwnershipService,
    VideoService,
    VideoFileTokenService,
    VideoResolver,
    VideoCaptionService,
    VideoChannelService,
    VideoPasswordService,
    VideoChapterService,
    CustomPageService,
    ActorRedirectGuard,
    InstanceService
  ]
}
