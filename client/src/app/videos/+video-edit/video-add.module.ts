import { NgModule } from '@angular/core'

import { VideoAddRoutingModule } from './video-add-routing.module'
import { VideoAddComponent } from './video-add.component'
import { VideoEditModule } from './video-edit.module'
import { SharedModule } from '../../shared'

@NgModule({
  imports: [
    VideoAddRoutingModule,
    VideoEditModule,
    SharedModule
  ],

  declarations: [
    VideoAddComponent
  ],

  exports: [
    VideoAddComponent
  ],

  providers: [ ]
})
export class VideoAddModule { }
