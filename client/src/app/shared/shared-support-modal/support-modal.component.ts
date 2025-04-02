import { Component, OnChanges, inject, input, viewChild } from '@angular/core'
import { MarkdownService } from '@app/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'

@Component({
  selector: 'my-support-modal',
  templateUrl: './support-modal.component.html',
  imports: [ GlobalIconComponent ]
})
export class SupportModalComponent implements OnChanges {
  private markdownService = inject(MarkdownService)
  private modalService = inject(NgbModal)

  readonly name = input.required<string>()
  readonly content = input.required<string>()

  readonly modal = viewChild<NgbModal>('modal')

  htmlSupport = ''

  ngOnChanges () {
    this.markdownService.enhancedMarkdownToHTML({ markdown: this.content(), withEmoji: true, withHtml: true })
      .then(r => this.htmlSupport = r)
  }

  show () {
    return this.modalService.open(this.modal(), { centered: true })
  }
}
