import { Routes } from '@angular/router'

import { UserRightGuard } from '../../core'
import { UserRight } from '../../../../../shared'
import { RequestSchedulersComponent } from './request-schedulers.component'
import { RequestSchedulersStatsComponent } from './request-schedulers-stats'

export const RequestSchedulersRoutes: Routes = [
  {
    path: 'requests',
    component: RequestSchedulersComponent,
    canActivate: [ UserRightGuard ],
    data: {
      userRight: UserRight.MANAGE_REQUEST_SCHEDULERS
    },
    children: [
      {
        path: '',
        redirectTo: 'stats',
        pathMatch: 'full'
      },
      {
        path: 'stats',
        component: RequestSchedulersStatsComponent,
        data: {
          meta: {
            title: 'Request stats'
          }
        }
      }
    ]
  }
]
