import { Component, Input, ViewChild } from '@angular/core'
import { MarkdownService } from '@app/core'
import { VideoDetails } from '@app/shared/shared-main/video/video-details.model'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { VideoChannel } from '@peertube/peertube-models'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'

@Component({
  selector: 'my-support-modal',
  templateUrl: './support-modal.component.html',
  standalone: true,
  imports: [ GlobalIconComponent ]
})
export class SupportModalComponent {
  @Input() video: VideoDetails = null
  @Input() videoChannel: VideoChannel = null

  @ViewChild('modal', { static: true }) modal: NgbModal

  htmlSupport = ''
  displayName = ''

  constructor (
    private markdownService: MarkdownService,
    private modalService: NgbModal
  ) { }

  show () {
    const modalRef = this.modalService.open(this.modal, { centered: true })

    const support = this.video?.support || this.videoChannel.support

    this.markdownService.enhancedMarkdownToHTML({ markdown: support, withEmoji: true, withHtml: true })
      .then(r => this.htmlSupport = r)

    this.displayName = this.video
      ? this.video.channel.displayName
      : this.videoChannel.displayName

    return modalRef
  }
}
