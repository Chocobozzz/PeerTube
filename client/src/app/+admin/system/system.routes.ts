import { Routes } from '@angular/router'
import { UserRightGuard } from '../../core'
import { UserRight } from '../../../../../shared'
import { JobsComponent } from '@app/+admin/system/jobs/jobs.component'
import { LogsComponent } from '@app/+admin/system/logs'
import { SystemComponent } from '@app/+admin/system/system.component'

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
      }
    ]
  }
]
