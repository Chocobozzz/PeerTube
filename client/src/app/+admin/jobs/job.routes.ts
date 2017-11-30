import { Routes } from '@angular/router'

import { UserRightGuard } from '../../core'
import { FollowingAddComponent } from './following-add'
import { UserRight } from '../../../../../shared'
import { FollowingListComponent } from './following-list/following-list.component'
import { JobsComponent } from './job.component'
import { JobsListComponent } from './jobs-list/jobs-list.component'

export const JobsRoutes: Routes = [
  {
    path: 'jobs',
    component: JobsComponent,
    canActivate: [ UserRightGuard ],
    data: {
      userRight: UserRight.MANAGE_JOBS
    },
    children: [
      {
        path: '',
        redirectTo: 'list',
        pathMatch: 'full'
      },
      {
        path: 'list',
        component: JobsListComponent,
        data: {
          meta: {
            title: 'Jobs list'
          }
        }
      }
    ]
  }
]
