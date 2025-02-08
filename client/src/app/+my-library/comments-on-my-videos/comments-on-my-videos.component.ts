import { Component } from '@angular/core'
import { GlobalIconComponent } from '../../shared/shared-icons/global-icon.component'
import { VideoCommentListAdminOwnerComponent } from '../../shared/shared-video-comment/video-comment-list-admin-owner.component'

@Component({
  templateUrl: './comments-on-my-videos.component.html',
  imports: [
    GlobalIconComponent,
    VideoCommentListAdminOwnerComponent
  ]
})
export class CommentsOnMyVideosComponent {
}
