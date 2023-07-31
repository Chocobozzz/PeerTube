import { Routes } from '@angular/router'
import { UserRightGuard } from '@app/core'
import { UserRight } from '@peertube/peertube-models'
import { RunnerJobListComponent } from './runner-job-list'
import { RunnerListComponent } from './runner-list'
import { RunnerRegistrationTokenListComponent } from './runner-registration-token-list'

export const RunnersRoutes: Routes = [
  {
    path: 'runners',
    canActivate: [ UserRightGuard ],
    data: {
      userRight: UserRight.MANAGE_RUNNERS
    },
    children: [
      {
        path: '',
        redirectTo: 'jobs-list',
        pathMatch: 'full'
      },

      {
        path: 'jobs-list',
        component: RunnerJobListComponent,
        data: {
          meta: {
            title: $localize`List runner jobs`
          }
        }
      },

      {
        path: 'runners-list',
        component: RunnerListComponent,
        data: {
          meta: {
            title: $localize`List remote runners`
          }
        }
      },

      {
        path: 'registration-tokens-list',
        component: RunnerRegistrationTokenListComponent,
        data: {
          meta: {
            title: $localize`List registration runner tokens`
          }
        }
      }
    ]
  }
]
