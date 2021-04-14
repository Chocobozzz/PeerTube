import { Component, Input, ViewChild } from '@angular/core'
import { MarkdownService } from '@app/core'
import { VideoDetails } from '@app/shared/shared-main'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { VideoChannel } from '@shared/models'

@Component({
  selector: 'my-support-modal',
  templateUrl: './support-modal.component.html'
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

    this.markdownService.enhancedMarkdownToHTML(support)
      .then(r => this.htmlSupport = r)

    this.displayName = this.video
      ? this.video.channel.displayName
      : this.videoChannel.displayName

    return modalRef
  }
}
