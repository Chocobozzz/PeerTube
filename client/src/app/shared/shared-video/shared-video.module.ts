
import { NgModule } from '@angular/core'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { VideoViewsCounterComponent } from './video-views-counter.component'

@NgModule({
  imports: [
    SharedMainModule
  ],

  declarations: [
    VideoViewsCounterComponent
  ],

  exports: [
    VideoViewsCounterComponent
  ]
})
export class SharedVideoModule { }
