import { Routes } from '@angular/router'

import { BlacklistComponent } from './blacklist.component'
import { BlacklistListComponent } from './blacklist-list'

export const BlacklistRoutes: Routes = [
  {
    path: 'blacklist',
    component: BlacklistComponent,
    children: [
      {
        path: '',
        redirectTo: 'list',
        pathMatch: 'full'
      },
      {
        path: 'list',
        component: BlacklistListComponent,
        data: {
          meta: {
            title: 'Blacklisted videos'
          }
        }
      }
    ]
  }
]
