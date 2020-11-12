import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { LoginGuard } from '../core'
import { MyHistoryComponent } from './my-history/my-history.component'
import { MyLibraryComponent } from './my-library.component'
import { MyOwnershipComponent } from './my-ownership/my-ownership.component'
import { MySubscriptionsComponent } from './my-subscriptions/my-subscriptions.component'
import { MyVideoImportsComponent } from './my-video-imports/my-video-imports.component'
import { MyVideoPlaylistCreateComponent } from './my-video-playlists/my-video-playlist-create.component'
import { MyVideoPlaylistElementsComponent } from './my-video-playlists/my-video-playlist-elements.component'
import { MyVideoPlaylistUpdateComponent } from './my-video-playlists/my-video-playlist-update.component'
import { MyVideoPlaylistsComponent } from './my-video-playlists/my-video-playlists.component'
import { MyVideosComponent } from './my-videos/my-videos.component'

const myLibraryRoutes: Routes = [
  {
    path: '',
    component: MyLibraryComponent,
    canActivateChild: [ MetaGuard, LoginGuard ],
    children: [
      {
        path: '',
        redirectTo: 'video-channels',
        pathMatch: 'full'
      },

      {
        path: 'video-channels',
        loadChildren: () => {
          return import('./+my-video-channels/my-video-channels.module').then(m => m.MyVideoChannelsModule)
        }
      },

      {
        path: 'video-playlists',
        component: MyVideoPlaylistsComponent,
        data: {
          meta: {
            title: $localize`My playlists`
          }
        }
      },
      {
        path: 'video-playlists/create',
        component: MyVideoPlaylistCreateComponent,
        data: {
          meta: {
            title: $localize`Create a new playlist`
          }
        }
      },
      {
        path: 'video-playlists/:videoPlaylistId',
        component: MyVideoPlaylistElementsComponent,
        data: {
          meta: {
            title: $localize`Playlist elements`
          }
        }
      },
      {
        path: 'video-playlists/update/:videoPlaylistId',
        component: MyVideoPlaylistUpdateComponent,
        data: {
          meta: {
            title: $localize`Update playlist`
          }
        }
      },

      {
        path: 'videos',
        component: MyVideosComponent,
        data: {
          meta: {
            title: $localize`My videos`
          },
          reuse: {
            enabled: true,
            key: 'my-videos-list'
          }
        }
      },
      {
        path: 'video-imports',
        component: MyVideoImportsComponent,
        data: {
          meta: {
            title: $localize`My video imports`
          }
        }
      },
      {
        path: 'subscriptions',
        component: MySubscriptionsComponent,
        data: {
          meta: {
            title: $localize`My subscriptions`
          }
        }
      },
      {
        path: 'ownership',
        component: MyOwnershipComponent,
        data: {
          meta: {
            title: $localize`Ownership changes`
          }
        }
      },

      {
        path: 'history/videos',
        component: MyHistoryComponent,
        data: {
          meta: {
            title: $localize`My video history`
          },
          reuse: {
            enabled: true,
            key: 'my-videos-history-list'
          }
        }
      }
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(myLibraryRoutes) ],
  exports: [ RouterModule ]
})
export class MyLibraryRoutingModule {}
