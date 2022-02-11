import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { VideoEditorEditResolver } from './edit'
import { VideoEditorEditComponent } from './edit/video-editor-edit.component'

const videoEditorRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'edit/:videoId',
        component: VideoEditorEditComponent,
        data: {
          meta: {
            title: $localize`Edit video`
          }
        },
        resolve: {
          video: VideoEditorEditResolver
        }
      }
    ]
  }
]

@NgModule({
  imports: [ RouterModule.forChild(videoEditorRoutes) ],
  exports: [ RouterModule ]
})
export class VideoEditorRoutingModule {}
