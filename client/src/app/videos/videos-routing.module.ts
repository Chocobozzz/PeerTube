import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'

import { MetaGuard } from '@ngx-meta/core'

import { VideoAddComponent, VideoUpdateComponent } from './video-edit'
import { VideoListComponent } from './video-list'
import { VideosComponent } from './videos.component'
import { VideoWatchComponent } from './video-watch'

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
        path: 'add',
        component: VideoAddComponent,
        data: {
          meta: {
            title: 'Add a video'
          }
        }
      },
      {
        path: 'edit/:uuid',
        component: VideoUpdateComponent,
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
        component: VideoWatchComponent
      }
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videosRoutes) ],
  exports: [ RouterModule ]
})
export class VideosRoutingModule {}
