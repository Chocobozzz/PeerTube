import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { VideoLocalComponent } from '@app/videos/video-list/video-local.component'
import { MetaGuard } from '@ngx-meta/core'
import { VideoRecentlyAddedComponent } from './video-list/video-recently-added.component'
import { VideoTrendingComponent } from './video-list/video-trending.component'
import { VideosComponent } from './videos.component'
import { VideoUserSubscriptionsComponent } from '@app/videos/video-list/video-user-subscriptions.component'
import { VideoOverviewComponent } from '@app/videos/video-list/video-overview.component'

const videosRoutes: Routes = [
  {
    path: 'videos',
    component: VideosComponent,
    canActivateChild: [ MetaGuard ],
    children: [
      {
        path: 'overview',
        component: VideoOverviewComponent,
        data: {
          meta: {
            title: 'Videos overview'
          }
        }
      },
      {
        path: 'trending',
        component: VideoTrendingComponent,
        data: {
          meta: {
            title: 'Trending videos'
          }
        }
      },
      {
        path: 'recently-added',
        component: VideoRecentlyAddedComponent,
        data: {
          meta: {
            title: 'Recently added videos'
          }
        }
      },
      {
        path: 'subscriptions',
        component: VideoUserSubscriptionsComponent,
        data: {
          meta: {
            title: 'Subscriptions'
          }
        }
      },
      {
        path: 'local',
        component: VideoLocalComponent,
        data: {
          meta: {
            title: 'Local videos'
          }
        }
      },
      {
        path: 'upload',
        loadChildren: 'app/videos/+video-edit/video-add.module#VideoAddModule',
        data: {
          meta: {
            title: 'Upload a video'
          }
        }
      },
      {
        path: 'update/:uuid',
        loadChildren: 'app/videos/+video-edit/video-update.module#VideoUpdateModule',
        data: {
          meta: {
            title: 'Edit a video'
          }
        }
      },
      {
        path: 'watch',
        loadChildren: 'app/videos/+video-watch/video-watch.module#VideoWatchModule',
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
