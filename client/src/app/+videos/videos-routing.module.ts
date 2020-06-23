import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { VideoOverviewComponent } from './video-list/overview/video-overview.component'
import { VideoLocalComponent } from './video-list/video-local.component'
import { VideoMostLikedComponent } from './video-list/video-most-liked.component'
import { VideoRecentlyAddedComponent } from './video-list/video-recently-added.component'
import { VideoTrendingComponent } from './video-list/video-trending.component'
import { VideoUserSubscriptionsComponent } from './video-list/video-user-subscriptions.component'
import { VideosComponent } from './videos.component'

const videosRoutes: Routes = [
  {
    path: '',
    component: VideosComponent,
    canActivateChild: [ MetaGuard ],
    children: [
      {
        path: 'overview',
        component: VideoOverviewComponent,
        data: {
          meta: {
            title: 'Discover videos'
          }
        }
      },
      {
        path: 'trending',
        component: VideoTrendingComponent,
        data: {
          meta: {
            title: 'Trending videos'
          },
          reuse: {
            enabled: true,
            key: 'trending-videos-list'
          }
        }
      },
      {
        path: 'most-liked',
        component: VideoMostLikedComponent,
        data: {
          meta: {
            title: 'Most liked videos'
          },
          reuse: {
            enabled: true,
            key: 'most-liked-videos-list'
          }
        }
      },
      {
        path: 'recently-added',
        component: VideoRecentlyAddedComponent,
        data: {
          meta: {
            title: 'Recently added videos'
          },
          reuse: {
            enabled: true,
            key: 'recently-added-videos-list'
          }
        }
      },
      {
        path: 'subscriptions',
        component: VideoUserSubscriptionsComponent,
        data: {
          meta: {
            title: 'Subscriptions'
          },
          reuse: {
            enabled: true,
            key: 'subscription-videos-list'
          }
        }
      },
      {
        path: 'local',
        component: VideoLocalComponent,
        data: {
          meta: {
            title: 'Local videos'
          },
          reuse: {
            enabled: true,
            key: 'local-videos-list'
          }
        }
      },
      {
        path: 'upload',
        loadChildren: () => import('@app/+videos/+video-edit/video-add.module').then(m => m.VideoAddModule),
        data: {
          meta: {
            title: 'Upload a video'
          }
        }
      },
      {
        path: 'update/:uuid',
        loadChildren: () => import('@app/+videos/+video-edit/video-update.module').then(m => m.VideoUpdateModule),
        data: {
          meta: {
            title: 'Edit a video'
          }
        }
      },
      {
        path: 'watch',
        loadChildren: () => import('@app/+videos/+video-watch/video-watch.module').then(m => m.VideoWatchModule),
        data: {
          preload: 3000
        }
      }
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videosRoutes) ],
  exports: [ RouterModule ]
})
export class VideosRoutingModule {}
