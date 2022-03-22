import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { VideoStudioEditComponent, VideoStudioEditResolver } from './edit'

const videoStudioRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'edit/:videoId',
        component: VideoStudioEditComponent,
        data: {
          meta: {
            title: $localize`Studio`
          }
        },
        resolve: {
          video: VideoStudioEditResolver
        }
      }
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videoStudioRoutes) ],
  exports: [ RouterModule ]
})
export class VideoStudioRoutingModule {}
