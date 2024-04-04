import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { HtmlRendererService } from '@app/core'
import { ConfirmService } from '@app/core/confirm/confirm.service'
import { POP_STATE_MODAL_DISMISS } from '@app/helpers'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { InputTextComponent } from '../shared/shared-forms/input-text.component'
import { FormsModule } from '@angular/forms'
import { NgIf } from '@angular/common'
import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-confirm',
  templateUrl: './confirm.component.html',
  styleUrls: [ './confirm.component.scss' ],
  standalone: true,
  imports: [ GlobalIconComponent, NgIf, FormsModule, InputTextComponent ]
})
export class ConfirmComponent implements OnInit {
  @ViewChild('confirmModal', { static: true }) confirmModal: ElementRef

  title = ''
  message = ''
  expectedInputValue = ''
  inputLabel = ''

  inputValue = ''
  confirmButtonText = ''

  errorMessage = ''

  isPasswordInput = false

  private openedModal: NgbModalRef

  constructor (
    private modalService: NgbModal,
    private html: HtmlRendererService,
    private confirmService: ConfirmService
  ) { }

  ngOnInit () {
    this.confirmService.showConfirm.subscribe(
      payload => {
        // Reinit fields
        this.title = ''
        this.message = ''
        this.expectedInputValue = ''
        this.inputLabel = ''
        this.inputValue = ''
        this.confirmButtonText = ''
        this.isPasswordInput = false
        this.errorMessage = ''

        const { type, title, message, confirmButtonText, errorMessage } = payload

        this.title = title

        if (type === 'confirm-expected-input') {
          this.inputLabel = payload.inputLabel
          this.expectedInputValue = payload.expectedInputValue
        } else if (type === 'confirm-password') {
          this.inputLabel = $localize`Confirm your password`
          this.isPasswordInput = true
          this.errorMessage = errorMessage
        }

        this.confirmButtonText = confirmButtonText || $localize`Confirm`

        this.html.toSafeHtml(message)
          .then(html => {
            this.message = html

            this.showModal()
          })
      }
    )
  }

  confirm () {
    if (this.openedModal) this.openedModal.close()
  }

  isConfirmationDisabled () {
    // No input validation
    if (!this.inputLabel || !this.expectedInputValue) return false

    return this.expectedInputValue !== this.inputValue
  }

  hasError () {
    return this.errorMessage
  }
  showModal () {
    this.inputValue = ''

    this.openedModal = this.modalService.open(this.confirmModal, { centered: true })

    this.openedModal.result
        .then(() => {
          this.confirmService.confirmResponse.next({ confirmed: true, value: this.inputValue })
        })
        .catch((reason: string) => {
          // If the reason was that the user used the back button, we don't care about the confirm dialog result
          if (!reason || reason !== POP_STATE_MODAL_DISMISS) {
            this.confirmService.confirmResponse.next({ confirmed: false, value: this.inputValue })
          }
        })
  }
}
