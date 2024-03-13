import { Routes } from '@angular/router'
import { CanDeactivateGuard, LoginGuard } from '@app/core'
import { VideoAddComponent } from './video-add.component'
import { I18nPrimengCalendarService } from './shared/i18n-primeng-calendar.service'
import { VideoUploadService } from './shared/video-upload.service'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'

export default [
  {
    path: '',
    component: VideoAddComponent,
    canActivate: [ LoginGuard ],
    canDeactivate: [ CanDeactivateGuard ],
    providers: [
      LiveVideoService,
      I18nPrimengCalendarService,
      VideoUploadService
    ]
  }
] satisfies Routes
