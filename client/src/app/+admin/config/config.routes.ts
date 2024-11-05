import { Routes } from '@angular/router'
import { EditCustomConfigComponent } from '@app/+admin/config/edit-custom-config'
import { UserRightGuard } from '@app/core'
import { UserRight } from '@peertube/peertube-models'

export const configRoutes: Routes = [
  {
    path: 'config',
    canActivate: [ UserRightGuard ],
    data: {
      userRight: UserRight.MANAGE_CONFIGURATION
    },
    children: [
      {
        path: '',
        redirectTo: 'edit-custom',
        pathMatch: 'full'
      },
      {
        path: 'edit-custom',
        component: EditCustomConfigComponent,
        data: {
          meta: {
            title: $localize`Edit custom configuration`
          }
        }
      }
    ]
  }
]
