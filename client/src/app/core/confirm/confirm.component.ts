import { Component, HostListener, OnInit, ViewChild } from '@angular/core'

import { ModalDirective } from 'ngx-bootstrap/modal'

import { ConfirmService } from './confirm.service'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-confirm',
  templateUrl: './confirm.component.html',
  styleUrls: [ './confirm.component.scss' ]
})
export class ConfirmComponent implements OnInit {
  @ViewChild('confirmModal') confirmModal: ModalDirective

  title = ''
  message = ''
  expectedInputValue = ''
  inputLabel = ''

  inputValue = ''
  confirmButtonText = ''

  constructor (
    private confirmService: ConfirmService,
    private i18n: I18n
  ) {
    // Empty
  }

  ngOnInit () {
    this.confirmModal.config = {
      backdrop: 'static',
      keyboard: false
    }

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

  @HostListener('keydown.enter')
  confirm () {
    this.confirmService.confirmResponse.next(true)
    this.hideModal()
  }

  @HostListener('keydown.esc')
  cancel () {
    this.confirmService.confirmResponse.next(false)
    this.hideModal()
  }

  isConfirmationDisabled () {
    // No input validation
    if (!this.inputLabel || !this.expectedInputValue) return false

    return this.expectedInputValue !== this.inputValue
  }

  showModal () {
    this.confirmModal.show()
  }

  hideModal () {
    this.confirmModal.hide()
  }
}
