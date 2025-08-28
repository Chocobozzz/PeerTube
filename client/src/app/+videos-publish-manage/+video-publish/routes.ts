import { inject } from '@angular/core'
import { RedirectCommand, Router, Routes } from '@angular/router'
import { CanDeactivateGuard, LoginGuard } from '@app/core'
import { LiveVideoService } from '@app/shared/shared-video-live/live-video.service'
import { PlayerSettingsService } from '@app/shared/shared-video/player-settings.service'
import { VideoStateMessageService } from '@app/shared/shared-video/video-state-message.service'
import debug from 'debug'
import { I18nPrimengCalendarService } from '../shared-manage/common/i18n-primeng-calendar.service'
import { VideoUploadService } from '../shared-manage/common/video-upload.service'
import { manageRoutes } from '../shared-manage/routes'
import { VideoStudioService } from '../shared-manage/studio/video-studio.service'
import { VideoManageController } from '../shared-manage/video-manage-controller.service'
import { VideoPublishComponent } from './video-publish.component'
import { VideoPublishResolver } from './video-publish.resolver'

const debugLogger = debug('peertube:video-publish')

export default [
  {
    path: '',
    component: VideoPublishComponent,
    canActivate: [
      LoginGuard,

      () => {
        const publishedId = new URLSearchParams(window.location.search).get('publishedId')
        const router = inject(Router)

        if (publishedId) {
          const match = window.location.pathname.match(/^\/videos\/publish\/(.*)$/)
          const suffixUrl = match
            ? `/${match[1]}`
            : ''

          debugLogger('Redirecting to video manage page', { publishedId, match, suffixUrl })

          return new RedirectCommand(router.parseUrl(`/videos/manage/${publishedId}${suffixUrl}`))
        }

        return true
      }
    ],
    canDeactivate: [ CanDeactivateGuard ],
    providers: [
      VideoPublishResolver,
      VideoManageController,
      PlayerSettingsService,
      VideoStateMessageService,
      LiveVideoService,
      I18nPrimengCalendarService,
      VideoUploadService,
      VideoStudioService
    ],
    resolve: {
      resolverData: VideoPublishResolver
    },
    children: manageRoutes
  }
] satisfies Routes
