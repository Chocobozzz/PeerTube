import { Routes } from '@angular/router'
import { UserRightGuard } from '@app/core'
import { UserRight } from '@peertube/peertube-models'
import { VideoCommentListComponent } from './video-comment-list.component'

export const commentRoutes: Routes = [
  {
    path: 'comments',
    canActivate: [ UserRightGuard ],
    data: {
      userRight: UserRight.SEE_ALL_COMMENTS
    },
    children: [
      {
        path: '',
        redirectTo: 'list',
        pathMatch: 'full'
      },
      {
        path: 'list',
        component: VideoCommentListComponent,
        data: {
          meta: {
            title: $localize`Comments list`
          }
        }
      }
    ]
  }
]
