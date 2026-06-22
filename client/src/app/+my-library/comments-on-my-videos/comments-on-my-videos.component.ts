import { Component, ChangeDetectionStrategy } from '@angular/core'

import { VideoCommentListAdminOwnerComponent } from '../../shared/shared-video-comment/video-comment-list-admin-owner.component'

@Component({
  template: `<my-video-comment-list-admin-owner mode="user" key="UserVideoCommentList"></my-video-comment-list-admin-owner>`,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    VideoCommentListAdminOwnerComponent
  ]
})
export class CommentsOnMyVideosComponent {
}
