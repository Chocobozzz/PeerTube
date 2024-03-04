import { DatePipe } from '@angular/common'
import { AccountService } from './account'
import { FromNowPipe } from './angular'
import { CustomPageService } from './custom-page'
import { ActorRedirectGuard } from './router'
import { UserHistoryService, UserNotificationService } from './users'
import {
  RedundancyService,
  VideoImportService,
  VideoOwnershipService,
  VideoService,
  VideoFileTokenService,
  VideoResolver,
  VideoPasswordService,
  VideoChapterService
} from './video'
import { VideoCaptionService } from './video-caption'
import { VideoChannelService } from './video-channel'
import { AUTH_INTERCEPTOR_PROVIDER } from './auth'
import { InstanceService } from './instance'

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
