import { Routes } from '@angular/router';

import { VideoAddComponent } from './video-add';
import { VideoListComponent } from './video-list';
import { VideosComponent } from './videos.component';
import { VideoWatchComponent } from './video-watch';

export const VideosRoutes: Routes = [
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
        path: 'watch/:id',
        component: VideoWatchComponent
      }
    ]
  }
];
