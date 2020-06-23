
import { NgModule } from '@angular/core'
import { SharedGlobalIconModule } from '../shared-icons'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { VideoThumbnailComponent } from './video-thumbnail.component'

@NgModule({
  imports: [
    SharedMainModule,
    SharedGlobalIconModule
  ],

  declarations: [
    VideoThumbnailComponent
  ],

  exports: [
    VideoThumbnailComponent
  ],

  providers: [ ]
})
export class SharedThumbnailModule { }
