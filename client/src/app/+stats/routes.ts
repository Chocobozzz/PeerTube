import { Routes } from '@angular/router'
import { LoginGuard } from '@app/core'
import { VideoResolver } from '@app/shared/shared-main'
import { VideoStatsComponent, VideoStatsService } from './video'
import { LiveVideoService } from '@app/shared/shared-video-live'

export default [
  {
    path: 'videos/:videoId',
    canActivate: [ LoginGuard ],
    component: VideoStatsComponent,
    data: {
      meta: {
        title: $localize`Video stats`
      }
    },
    providers: [
      LiveVideoService,
      VideoStatsService,
      VideoResolver
    ],
    resolve: {
      video: VideoResolver
    }
  }
] satisfies Routes
