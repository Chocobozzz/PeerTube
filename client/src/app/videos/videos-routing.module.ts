import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { MetaGuard } from '@ngx-meta/core'
import { VideoSearchComponent } from './video-list'
import { VideoRecentlyAddedComponent } from './video-list/video-recently-added.component'
import { VideoTrendingComponent } from './video-list/video-trending.component'
import { VideosComponent } from './videos.component'

const videosRoutes: Routes = [
  {
    path: 'videos',
    component: VideosComponent,
    canActivateChild: [ MetaGuard ],
    children: [
      {
        path: 'list',
        pathMatch: 'full',
        redirectTo: 'recently-added'
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
        path: 'search',
        component: VideoSearchComponent,
        data: {
          meta: {
            title: 'Search videos'
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
        path: 'edit/:uuid',
        loadChildren: 'app/videos/+video-edit/video-update.module#VideoUpdateModule',
        data: {
          meta: {
            title: 'Edit a video'
          }
        }
      },
      {
        path: ':uuid',
        pathMatch: 'full',
        redirectTo: 'watch/:uuid'
      },
      {
        path: 'watch/:uuid',
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
