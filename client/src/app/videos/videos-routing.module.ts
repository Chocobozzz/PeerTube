import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { VideoAddComponent } from './video-add';
import { VideoListComponent } from './video-list';
import { VideosComponent } from './videos.component';
import { VideoWatchComponent } from './video-watch';

const videosRoutes: Routes = [
  {
    path: 'videos',
    component: VideosComponent,
    children: [
      {
        path: 'list',
        component: VideoListComponent,
        data: {
          meta: {
            titleSuffix: ' - Videos list'
          }
        }
      },
      {
        path: 'add',
        component: VideoAddComponent,
        data: {
          meta: {
            titleSuffix: ' - Add a video'
          }
        }
      },
      {
        path: ':id',
        redirectTo: 'watch/:id'
      },
      {
        path: 'watch/:id',
        component: VideoWatchComponent
      }
    ]
  }
];

@NgModule({
  imports: [ RouterModule.forChild(videosRoutes) ],
  exports: [ RouterModule ]
})
export class VideosRoutingModule {}
