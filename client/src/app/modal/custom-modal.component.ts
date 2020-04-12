import { Component, ElementRef, ViewChild, Input } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'

@Component({
  selector: 'my-custom-modal',
  templateUrl: './custom-modal.component.html',
  styleUrls: [ './custom-modal.component.scss' ]
})
export class CustomModalComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  @Input() title: string
  @Input() content: string
  @Input() close?: boolean
  @Input() cancel?: { value: string, action?: () => void }
  @Input() confirm?: { value: string, action?: () => void }

  constructor (
    private modalService: NgbModal
  ) { }

  show (input: {
    title: string,
    content: string,
    close?: boolean,
    cancel?: { value: string, action?: () => void },
    confirm?: { value: string, action?: () => void }
  }) {
    const { title, content, close, cancel, confirm } = input

    this.title = title
    this.content = content
    this.close = close
    this.cancel = cancel
    this.confirm = confirm

    this.modalService.open(this.modal, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      size: 'lg'
    })
  }
}
