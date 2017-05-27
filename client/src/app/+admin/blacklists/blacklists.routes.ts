import { Routes } from '@angular/router';

import { BlacklistsComponent } from './blacklists.component';
import { BlacklistListComponent } from './blacklist-list';

export const BlacklistsRoutes: Routes = [
  {
    path: 'blacklists',
    component: BlacklistsComponent,
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
];
