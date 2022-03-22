import { NgModule } from '@angular/core'
import { SharedFormModule } from '@app/shared/shared-forms'
import { SharedMainModule } from '@app/shared/shared-main'
import { VideoStudioEditComponent, VideoStudioEditResolver } from './edit'
import { VideoStudioService } from './shared'
import { VideoStudioRoutingModule } from './video-studio-routing.module'

@NgModule({
  imports: [
    VideoStudioRoutingModule,

    SharedMainModule,
    SharedFormModule
  ],

  declarations: [
    VideoStudioEditComponent
  ],

  exports: [],

  providers: [
    VideoStudioService,
    VideoStudioEditResolver
  ]
})
export class VideoStudioModule { }
