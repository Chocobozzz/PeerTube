import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { LoginGuard, TrendingGuard } from '@app/core'
import { MetaGuard } from '@ngx-meta/core'
import { VideoOverviewComponent } from './video-list/overview/video-overview.component'
import { VideoHotComponent } from './video-list/trending/video-hot.component'
import { VideoMostLikedComponent } from './video-list/trending/video-most-liked.component'
import { VideoMostViewedComponent } from './video-list/trending/video-most-viewed.component'
import { VideoLocalComponent } from './video-list/video-local.component'
import { VideoRecentlyAddedComponent } from './video-list/video-recently-added.component'
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
            title: $localize`Discover videos`
          }
        }
      },
      {
        path: 'trending',
        canActivate: [ TrendingGuard ]
      },
      {
        path: 'hot',
        component: VideoHotComponent,
        data: {
          meta: {
            title: $localize`Hot videos`
          },
          reuse: {
            enabled: true,
            key: 'hot-videos-list'
          }
        }
      },
      {
        path: 'most-viewed',
        component: VideoMostViewedComponent,
        data: {
          meta: {
            title: $localize`Most viewed videos`
          },
          reuse: {
            enabled: true,
            key: 'most-viewed-videos-list'
          }
        }
      },
      {
        path: 'most-liked',
        component: VideoMostLikedComponent,
        data: {
          meta: {
            title: $localize`Most liked videos`
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
            title: $localize`Recently added videos`
          },
          reuse: {
            enabled: true,
            key: 'recently-added-videos-list'
          }
        }
      },
      {
        path: 'subscriptions',
        canActivate: [ LoginGuard ],
        component: VideoUserSubscriptionsComponent,
        data: {
          meta: {
            title: $localize`Subscriptions`
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
            title: $localize`Local videos`
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
            title: $localize`Upload a video`
          }
        }
      },
      {
        path: 'update/:uuid',
        loadChildren: () => import('@app/+videos/+video-edit/video-update.module').then(m => m.VideoUpdateModule),
        data: {
          meta: {
            title: $localize`Edit a video`
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
