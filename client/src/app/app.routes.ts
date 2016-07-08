import { RouterConfig } from '@angular/router';

import { LoginRoutes } from './login';
import { VideosRoutes } from './videos';

export const routes: RouterConfig = [
  {
    path: '',
    redirectTo: '/videos/list',
    pathMatch: 'full'
  },

  ...LoginRoutes,
  ...VideosRoutes
];
