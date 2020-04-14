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
  @Input() close?: boolean = false
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

  private hasCancel () {
    return typeof this.cancel !== 'undefined'
  }

  private hasConfirm () {
    return typeof this.confirm !== 'undefined'
  }

  onClickCancel () {
    this.modalService.dismissAll()

    delete this.title
    delete this.content
    delete this.close
    delete this.confirm

    if (this.hasCancel() && (typeof this.cancel.action === 'function')) {
      this.cancel.action()
    }

    delete this.cancel
  }

  onClickConfirm () {
    this.modalService.dismissAll()

    delete this.title
    delete this.content
    delete this.close
    delete this.cancel

    if (this.hasConfirm() && (typeof this.confirm.action === 'function')) {
      this.confirm.action()
    }

    delete this.confirm
  }
}
