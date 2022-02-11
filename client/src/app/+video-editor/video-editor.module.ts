import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedMainModule } from '@app/shared/shared-main'
import { VideoEditorEditComponent, VideoEditorEditResolver } from './edit'
import { VideoEditorService } from './shared'
import { VideoEditorRoutingModule } from './video-editor-routing.module'

@NgModule({
  imports: [
    VideoEditorRoutingModule,

    SharedMainModule,
    SharedFormModule
  ],

  declarations: [
    VideoEditorEditComponent
  ],

  exports: [],

  providers: [
    VideoEditorService,
    VideoEditorEditResolver
  ]
})
export class VideoEditorModule { }
