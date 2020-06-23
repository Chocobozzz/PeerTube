import { Routes } from '@angular/router'
import { UserRightGuard } from '@app/core'
import { UserRight } from '@shared/models'
import { DebugComponent } from './debug'
import { JobsComponent } from './jobs/jobs.component'
import { LogsComponent } from './logs'
import { SystemComponent } from './system.component'

export const SystemRoutes: Routes = [
  {
    path: 'system',
    component: SystemComponent,
    data: {
    },
    children: [
      {
        path: '',
        redirectTo: 'jobs',
        pathMatch: 'full'
      },
      {
        path: 'jobs',
        canActivate: [ UserRightGuard ],
        component: JobsComponent,
        data: {
          meta: {
            userRight: UserRight.MANAGE_JOBS,
            title: 'Jobs'
          }
        }
      },
      {
        path: 'logs',
        canActivate: [ UserRightGuard ],
        component: LogsComponent,
        data: {
          meta: {
            userRight: UserRight.MANAGE_LOGS,
            title: 'Logs'
          }
        }
      },
      {
        path: 'debug',
        canActivate: [ UserRightGuard ],
        component: DebugComponent,
        data: {
          meta: {
            userRight: UserRight.MANAGE_DEBUG,
            title: 'Debug'
          }
        }
      }
    ]
  }
]
