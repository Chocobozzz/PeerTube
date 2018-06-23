import { Component, Input, ViewChild } from '@angular/core'
import { MarkdownService } from '@app/videos/shared'

import { ModalDirective } from 'ngx-bootstrap/modal'
import { VideoDetails } from '../../../shared/video/video-details.model'

@Component({
  selector: 'my-video-support',
  templateUrl: './video-support.component.html',
  styleUrls: [ './video-support.component.scss' ]
})
export class VideoSupportComponent {
  @Input() video: VideoDetails = null

  @ViewChild('modal') modal: ModalDirective

  videoHTMLSupport = ''

  constructor (private markdownService: MarkdownService) {
    // empty
  }

  show () {
    this.modal.show()

    this.videoHTMLSupport = this.markdownService.enhancedMarkdownToHTML(this.video.support)
  }

  hide () {
    this.modal.hide()
  }
}
