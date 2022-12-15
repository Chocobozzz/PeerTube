import { NgModule } from '@angular/core'
import { VideoEditModule } from './shared/video-edit.module'
import { VideoUpdateRoutingModule } from './video-update-routing.module'
import { VideoUpdateComponent } from './video-update.component'
import { VideoUpdateResolver } from './video-update.resolver'

@NgModule({
  imports: [
    VideoUpdateRoutingModule,

    VideoEditModule
  ],

  declarations: [
    VideoUpdateComponent
  ],

  exports: [ ],

  providers: [
    VideoUpdateResolver
  ]
})
export class VideoUpdateModule { }
