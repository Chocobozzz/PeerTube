import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core'
import { ConfirmService } from './confirm.service'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'

@Component({
  selector: 'my-confirm',
  templateUrl: './confirm.component.html',
  styleUrls: [ './confirm.component.scss' ]
})
export class ConfirmComponent implements OnInit {
  @ViewChild('confirmModal') confirmModal: ElementRef

  title = ''
  message = ''
  expectedInputValue = ''
  inputLabel = ''

  inputValue = ''
  confirmButtonText = ''

  private openedModal: NgbModalRef

  constructor (
    private modalService: NgbModal,
    private confirmService: ConfirmService,
    private i18n: I18n
  ) {
    // Empty
  }

  ngOnInit () {
    this.confirmService.showConfirm.subscribe(
      ({ title, message, expectedInputValue, inputLabel, confirmButtonText }) => {
        this.title = title
        this.message = message

        this.inputLabel = inputLabel
        this.expectedInputValue = expectedInputValue

        this.confirmButtonText = confirmButtonText || this.i18n('Confirm')

        this.showModal()
      }
    )
  }

  @HostListener('document:keydown.enter')
  confirm () {
    if (this.openedModal) this.openedModal.close()
  }

  isConfirmationDisabled () {
    // No input validation
    if (!this.inputLabel || !this.expectedInputValue) return false

    return this.expectedInputValue !== this.inputValue
  }

  showModal () {
    this.inputValue = ''

    this.openedModal = this.modalService.open(this.confirmModal)

    this.openedModal.result
        .then(() => this.confirmService.confirmResponse.next(true))
        .catch(() => this.confirmService.confirmResponse.next(false))
  }
}
