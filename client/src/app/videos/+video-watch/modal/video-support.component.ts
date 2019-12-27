import { Component, Input, ViewChild } from '@angular/core'
import { VideoDetails } from '../../../shared/video/video-details.model'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { MarkdownService } from '@app/shared/renderer'
import { User } from '@app/shared'

@Component({
  selector: 'my-video-support',
  templateUrl: './video-support.component.html',
  styleUrls: [ './video-support.component.scss' ]
})
export class VideoSupportComponent {
  @Input() video: VideoDetails = null
  @Input() user: User = null

  @ViewChild('modal', { static: true }) modal: NgbModal

  videoHTMLSupport = ''

  constructor (
    private markdownService: MarkdownService,
    private modalService: NgbModal
  ) { }

  show () {
    this.modalService.open(this.modal)

    this.markdownService.enhancedMarkdownToHTML(this.video.support)
      .then(r => this.videoHTMLSupport = r)
  }
}
