import { Routes } from '@angular/router'
import { UserRightGuard } from '../../core'
import { UserRight } from '../../../../../shared'
import { JobsComponent } from '@app/+admin/system/jobs/jobs.component'
import { LogsComponent } from '@app/+admin/system/logs'
import { SystemComponent } from '@app/+admin/system/system.component'
import { DebugComponent } from '@app/+admin/system/debug'

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
