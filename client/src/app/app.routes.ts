import { RouterConfig } from '@angular/router';

import { AccountRoutes } from './account';
import { LoginRoutes } from './login';
import { AdminRoutes } from './admin';
import { VideosRoutes } from './videos';

export const routes: RouterConfig = [
  {
    path: '',
    redirectTo: '/videos/list',
    pathMatch: 'full'
  },
  ...AdminRoutes,
  ...AccountRoutes,
  ...LoginRoutes,
  ...VideosRoutes
];
