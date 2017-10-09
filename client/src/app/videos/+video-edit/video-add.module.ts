import { NgModule } from '@angular/core'

import { TagInputModule } from 'ngx-chips'

import { VideoAddRoutingModule } from './video-add-routing.module'
import { VideoAddComponent } from './video-add.component'
import { VideoService } from '../shared'
import { SharedModule } from '../../shared'

@NgModule({
  imports: [
    TagInputModule,

    VideoAddRoutingModule,
    SharedModule
  ],

  declarations: [
    VideoAddComponent
  ],

  exports: [
    VideoAddComponent
  ],

  providers: [
    VideoService
  ]
})
export class VideoAddModule { }
