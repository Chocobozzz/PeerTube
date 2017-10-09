import { NgModule } from '@angular/core'

import { TagInputModule } from 'ngx-chips'

import { VideoUpdateRoutingModule } from './video-update-routing.module'
import { VideoUpdateComponent } from './video-update.component'
import { VideoService } from '../shared'
import { SharedModule } from '../../shared'

@NgModule({
  imports: [
    TagInputModule,

    VideoUpdateRoutingModule,
    SharedModule
  ],

  declarations: [
    VideoUpdateComponent
  ],

  exports: [
    VideoUpdateComponent
  ],

  providers: [
    VideoService
  ]
})
export class VideoUpdateModule { }
