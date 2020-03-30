import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { LoginGuard } from '../core'
import { MyAccountComponent } from './my-account.component'
import { MyAccountSettingsComponent } from './my-account-settings/my-account-settings.component'
import { MyAccountVideosComponent } from './my-account-videos/my-account-videos.component'
import { MyAccountVideoImportsComponent } from '@app/+my-account/my-account-video-imports/my-account-video-imports.component'
import { MyAccountSubscriptionsComponent } from '@app/+my-account/my-account-subscriptions/my-account-subscriptions.component'
import { MyAccountOwnershipComponent } from '@app/+my-account/my-account-ownership/my-account-ownership.component'
import { MyAccountBlocklistComponent } from '@app/+my-account/my-account-blocklist/my-account-blocklist.component'
import { MyAccountServerBlocklistComponent } from '@app/+my-account/my-account-blocklist/my-account-server-blocklist.component'
import { MyAccountHistoryComponent } from '@app/+my-account/my-account-history/my-account-history.component'
import { MyAccountNotificationsComponent } from '@app/+my-account/my-account-notifications/my-account-notifications.component'
import { MyAccountVideoPlaylistsComponent } from '@app/+my-account/my-account-video-playlists/my-account-video-playlists.component'
import {
  MyAccountVideoPlaylistCreateComponent
} from '@app/+my-account/my-account-video-playlists/my-account-video-playlist-create.component'
import {
  MyAccountVideoPlaylistUpdateComponent
} from '@app/+my-account/my-account-video-playlists/my-account-video-playlist-update.component'
import {
  MyAccountVideoPlaylistElementsComponent
} from '@app/+my-account/my-account-video-playlists/my-account-video-playlist-elements.component'

const myAccountRoutes: Routes = [
  {
    path: '',
    component: MyAccountComponent,
    canActivateChild: [ MetaGuard, LoginGuard ],
    children: [
      {
        path: '',
        redirectTo: 'settings',
        pathMatch: 'full'
      },
      {
        path: 'settings',
        component: MyAccountSettingsComponent,
        data: {
          meta: {
            title: 'Account settings'
          }
        }
      },

      {
        path: 'video-channels',
        loadChildren: () => import('./my-account-video-channels/my-account-video-channels.module').then(m => m.MyAccountVideoChannelsModule)
      },

      {
        path: 'video-playlists',
        component: MyAccountVideoPlaylistsComponent,
        data: {
          meta: {
            title: 'Account playlists'
          }
        }
      },
      {
        path: 'video-playlists/create',
        component: MyAccountVideoPlaylistCreateComponent,
        data: {
          meta: {
            title: 'Create new playlist'
          }
        }
      },
      {
        path: 'video-playlists/:videoPlaylistId',
        component: MyAccountVideoPlaylistElementsComponent,
        data: {
          meta: {
            title: 'Playlist elements'
          }
        }
      },
      {
        path: 'video-playlists/update/:videoPlaylistId',
        component: MyAccountVideoPlaylistUpdateComponent,
        data: {
          meta: {
            title: 'Update playlist'
          }
        }
      },

      {
        path: 'videos',
        component: MyAccountVideosComponent,
        data: {
          meta: {
            title: 'Account videos'
          },
          reuse: {
            enabled: true,
            key: 'my-account-videos-list'
          }
        }
      },
      {
        path: 'video-imports',
        component: MyAccountVideoImportsComponent,
        data: {
          meta: {
            title: 'Account video imports'
          }
        }
      },
      {
        path: 'subscriptions',
        component: MyAccountSubscriptionsComponent,
        data: {
          meta: {
            title: 'Account subscriptions'
          }
        }
      },
      {
        path: 'ownership',
        component: MyAccountOwnershipComponent,
        data: {
          meta: {
            title: 'Ownership changes'
          }
        }
      },
      {
        path: 'blocklist/accounts',
        component: MyAccountBlocklistComponent,
        data: {
          meta: {
            title: 'Muted accounts'
          }
        }
      },
      {
        path: 'blocklist/servers',
        component: MyAccountServerBlocklistComponent,
        data: {
          meta: {
            title: 'Muted instances'
          }
        }
      },
      {
        path: 'history/videos',
        component: MyAccountHistoryComponent,
        data: {
          meta: {
            title: 'Videos history'
          },
          reuse: {
            enabled: true,
            key: 'my-videos-history-list'
          }
        }
      },
      {
        path: 'notifications',
        component: MyAccountNotificationsComponent,
        data: {
          meta: {
            title: 'Notifications'
          }
        }
      }
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(myAccountRoutes) ],
  exports: [ RouterModule ]
})
export class MyAccountRoutingModule {}
