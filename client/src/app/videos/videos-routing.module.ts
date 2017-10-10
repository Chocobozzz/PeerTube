import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { MetaGuard } from '@ngx-meta/core'

import { VideoListComponent } from './video-list'
import { VideosComponent } from './videos.component'

const videosRoutes: Routes = [
  {
    path: 'videos',
    component: VideosComponent,
    canActivateChild: [ MetaGuard ],
    children: [
      {
        path: 'list',
        component: VideoListComponent,
        data: {
          meta: {
            title: 'Videos list'
          }
        }
      },
      {
        path: 'upload',
        loadChildren: 'app/videos/+video-edit#VideoAddModule',
        data: {
          meta: {
            title: 'Upload a video'
          }
        }
      },
      {
        path: 'edit/:uuid',
        loadChildren: 'app/videos/+video-edit#VideoUpdateModule',
        data: {
          meta: {
            title: 'Edit a video'
          }
        }
      },
      {
        path: ':uuid',
        redirectTo: 'watch/:uuid'
      },
      {
        path: 'watch/:uuid',
        loadChildren: 'app/videos/+video-watch#VideoWatchModule',
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
