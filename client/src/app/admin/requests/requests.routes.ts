import { Routes } from '@angular/router';

import { RequestsComponent } from './requests.component';
import { RequestStatsComponent } from './request-stats';

export const RequestsRoutes: Routes = [
  {
      path: 'requests',
      component: RequestsComponent,
      children: [
        {
          path: '',
          redirectTo: 'stats',
          pathMatch: 'full'
        },
        {
          path: 'stats',
          component: RequestStatsComponent
        }
      ]
    }
];
