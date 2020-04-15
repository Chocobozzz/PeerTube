import { Component, ElementRef, ViewChild, Input } from '@angular/core'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'

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

  private modalRef: NgbModalRef

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
    if (this.modalRef instanceof NgbModalRef && this.modalService.hasOpenModals()) {
      console.error('Cannot open another custom modal, one is already opened.')
      return
    }

    const { title, content, close, cancel, confirm } = input

    this.title = title
    this.content = content
    this.close = close
    this.cancel = cancel
    this.confirm = confirm

    this.modalRef = this.modalService.open(this.modal, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      size: 'lg'
    })
  }

  onCancelClick () {
    this.modalRef.close()

    if (typeof this.cancel.action === 'function') {
      this.cancel.action()
    }

    this.destroy()
  }

  onCloseClick () {
    this.modalRef.close()
    this.destroy()
  }

  onConfirmClick () {
    this.modalRef.close()

    if (typeof this.confirm.action === 'function') {
      this.confirm.action()
    }

    this.destroy()
  }

  hasCancel () {
    return typeof this.cancel !== 'undefined'
  }

  hasConfirm () {
    return typeof this.confirm !== 'undefined'
  }

  private destroy () {
    delete this.modalRef
    delete this.title
    delete this.content
    delete this.close
    delete this.cancel
    delete this.confirm
  }
}
