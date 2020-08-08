import { Component, Input, ViewChild } from '@angular/core'
import { MarkdownService } from '@app/core'
import { VideoDetails } from '@app/shared/shared-main'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-video-support',
  templateUrl: './video-support.component.html',
  styleUrls: [ './video-support.component.scss' ]
})
export class VideoSupportComponent {
  @Input() video: VideoDetails = null

  @ViewChild('modal', { static: true }) modal: NgbModal

  videoHTMLSupport = ''

  constructor (
    private markdownService: MarkdownService,
    private modalService: NgbModal
  ) { }

  show () {
    const modalRef = this.modalService.open(this.modal, { centered: true })

    this.markdownService.enhancedMarkdownToHTML(this.video.support)
      .then(r => this.videoHTMLSupport = r)

    return modalRef
  }
}
