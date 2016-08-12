import { RouterConfig } from '@angular/router';

import { FriendsComponent } from './friends.component';
import { FriendListComponent } from './friend-list';

export const FriendsRoutes: RouterConfig = [
  {
      path: 'friends',
      component: FriendsComponent,
      children: [
        {
          path: '',
          redirectTo: 'list',
          pathMatch: 'full'
        },
        {
          path: 'list',
          component: FriendListComponent
        }
      ]
    }
];
