import { Routes } from '@angular/router'
import { LoginGuard } from '@app/core'
import { VideoResolver } from '@app/shared/shared-main'
import { VideoStudioEditComponent } from './edit'
import { VideoStudioService } from './shared'

export default [
  {
    path: '',
    canActivateChild: [ LoginGuard ],
    providers: [ VideoStudioService ],
    children: [
      {
        path: 'edit/:videoId',
        component: VideoStudioEditComponent,
        data: {
          meta: {
            title: $localize`Studio`
          }
        },
        resolve: {
          video: VideoResolver
        }
      }
    ]
  }
] satisfies Routes
