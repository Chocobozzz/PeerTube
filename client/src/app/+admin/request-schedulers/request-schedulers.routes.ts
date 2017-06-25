import { Routes } from '@angular/router'

import { RequestSchedulersComponent } from './request-schedulers.component'
import { RequestSchedulersStatsComponent } from './request-schedulers-stats'

export const RequestSchedulersRoutes: Routes = [
  {
    path: 'requests',
    component: RequestSchedulersComponent,
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
