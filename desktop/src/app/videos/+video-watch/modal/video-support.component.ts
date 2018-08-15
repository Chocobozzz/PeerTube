import { Component, Input, ViewChild } from '@angular/core'
import { MarkdownService } from '@app/videos/shared'

import { VideoDetails } from '../../../shared/video/video-details.model'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-video-support',
  templateUrl: './video-support.component.html',
  styleUrls: [ './video-support.component.scss' ]
})
export class VideoSupportComponent {
  @Input() video: VideoDetails = null

  @ViewChild('modal') modal: NgbModal

  videoHTMLSupport = ''

  constructor (
    private markdownService: MarkdownService,
    private modalService: NgbModal
  ) {
    // empty
  }

  show () {
    this.videoHTMLSupport = this.markdownService.enhancedMarkdownToHTML(this.video.support)
    this.modalService.open(this.modal)
  }
}
