import { Component } from '@angular/core'

import { VideoCommentListAdminOwnerComponent } from '../../shared/shared-video-comment/video-comment-list-admin-owner.component'

@Component({
  template: `<my-video-comment-list-admin-owner mode="user" key="UserVideoCommentList"></my-video-comment-list-admin-owner>`,
  imports: [
    VideoCommentListAdminOwnerComponent
  ]
})
export class CommentsOnMyVideosComponent {
}
