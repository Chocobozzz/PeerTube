import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { VideoResolver } from '@app/shared/shared-main'
import { VideoStudioEditComponent } from './edit'

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
          video: VideoResolver
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
