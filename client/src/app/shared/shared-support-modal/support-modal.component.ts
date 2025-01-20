import { Component, Input, OnChanges, ViewChild } from '@angular/core'
import { MarkdownService } from '@app/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'

@Component({
  selector: 'my-support-modal',
  templateUrl: './support-modal.component.html',
  standalone: true,
  imports: [ GlobalIconComponent ]
})
export class SupportModalComponent implements OnChanges {
  @Input({ required: true }) name: string
  @Input({ required: true }) content: string

  @ViewChild('modal', { static: true }) modal: NgbModal

  htmlSupport = ''

  constructor (
    private markdownService: MarkdownService,
    private modalService: NgbModal
  ) { }

  ngOnChanges () {
    this.markdownService.enhancedMarkdownToHTML({ markdown: this.content, withEmoji: true, withHtml: true })
      .then(r => this.htmlSupport = r)
  }

  show () {
    return this.modalService.open(this.modal, { centered: true })
  }
}
