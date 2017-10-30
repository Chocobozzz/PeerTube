import { NgModule } from '@angular/core'

import { VideoUpdateRoutingModule } from './video-update-routing.module'
import { VideoUpdateComponent } from './video-update.component'
import { VideoEditModule } from './video-edit.module'
import { SharedModule } from '../../shared'

@NgModule({
  imports: [
    VideoUpdateRoutingModule,
    VideoEditModule,
    SharedModule
  ],

  declarations: [
    VideoUpdateComponent
  ],

  exports: [
    VideoUpdateComponent
  ],

  providers: [ ]
})
export class VideoUpdateModule { }
