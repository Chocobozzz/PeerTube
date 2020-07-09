
import { NgModule } from '@angular/core'
import { SharedMainModule } from '../shared-main/shared-main.module'
import { VideoCommentService } from './video-comment.service'

@NgModule({
  imports: [
    SharedMainModule
  ],

  declarations: [ ],

  exports: [ ],

  providers: [
    VideoCommentService
  ]
})
export class SharedVideoCommentModule { }
