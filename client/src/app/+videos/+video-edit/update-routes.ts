import { Routes } from '@angular/router'
import { CanDeactivateGuard, LoginGuard } from '@app/core'
import { VideoUpdateComponent } from './video-update.component'
import { VideoUpdateResolver } from './video-update.resolver'
import { I18nPrimengCalendarService } from './shared/i18n-primeng-calendar.service'
import { VideoUploadService } from './shared/video-upload.service'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'

export default [
  {
    path: '',
    component: VideoUpdateComponent,
    canActivate: [ LoginGuard ],
    canDeactivate: [ CanDeactivateGuard ],
    providers: [
      VideoUpdateResolver,
      LiveVideoService,
      I18nPrimengCalendarService,
      VideoUploadService
    ],
    resolve: {
      videoData: VideoUpdateResolver
    }
  }
] satisfies Routes
