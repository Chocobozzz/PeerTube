import { Routes } from '@angular/router'
import { CanDeactivateGuard, LoginGuard } from '@app/core'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'
import { VideoStateMessageService } from '@app/shared/shared-video/video-state-message.service'
import { I18nPrimengCalendarService } from '../shared-manage/common/i18n-primeng-calendar.service'
import { VideoUploadService } from '../shared-manage/common/video-upload.service'
import { manageRoutes } from '../shared-manage/routes'
import { VideoStudioService } from '../shared-manage/studio/video-studio.service'
import { VideoManageComponent } from './video-manage.component'
import { VideoManageResolver } from './video-manage.resolver'
import { VideoManageController } from '../shared-manage/video-manage-controller.service'
import { PlayerSettingsService } from '@app/shared/shared-video/player-settings.service'

export default [
  {
    path: '',
    component: VideoManageComponent,
    canActivate: [ LoginGuard ],
    canDeactivate: [ CanDeactivateGuard ],
    providers: [
      VideoManageController,
      VideoManageResolver,
      LiveVideoService,
      I18nPrimengCalendarService,
      VideoUploadService,
      VideoStudioService,
      VideoStateMessageService,
      PlayerSettingsService
    ],
    resolve: {
      resolverData: VideoManageResolver
    },
    children: manageRoutes
  }
] satisfies Routes
