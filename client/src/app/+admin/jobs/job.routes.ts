import { Routes } from '@angular/router'
import { UserRight } from '../../../../../shared'
import { UserRightGuard } from '../../core'
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
