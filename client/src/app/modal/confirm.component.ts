import { ChangeDetectionStrategy, Component, ElementRef, OnInit, inject, viewChild } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { HtmlRendererService } from '@app/core'
import { ConfirmCloseReason, ConfirmService } from '@app/core/confirm/confirm.service'
import { POP_STATE_MODAL_DISMISS } from '@app/helpers'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { InputTextComponent } from '../shared/shared-forms/input-text.component'

import { GlobalIconComponent } from '../shared/shared-icons/global-icon.component'

const CANCEL_BUTTON_MODAL_DISMISS = 'cancel button dismiss'

@Component({
  selector: 'my-confirm',
  templateUrl: './confirm.component.html',
  styleUrls: [ './confirm.component.scss' ],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ GlobalIconComponent, FormsModule, InputTextComponent ]
})
export class ConfirmComponent implements OnInit {
  private modalService = inject(NgbModal)
  private html = inject(HtmlRendererService)
  private confirmService = inject(ConfirmService)

  readonly confirmModal = viewChild<ElementRef>('confirmModal')

  title = ''
  message = ''
  expectedInputValue = ''
  inputLabel = ''

  inputValue = ''

  moreInfo: { title: string, content: string }

  cancelButtonText = ''
  confirmButtonText = ''

  errorMessage = ''

  isPasswordInput = false

  private openedModal: NgbModalRef

  ngOnInit () {
    this.confirmService.showConfirm.subscribe(
      payload => {
        // Reinit fields
        this.title = ''
        this.message = ''
        this.expectedInputValue = ''
        this.inputLabel = ''
        this.inputValue = ''
        this.moreInfo = undefined
        this.confirmButtonText = ''
        this.isPasswordInput = false
        this.errorMessage = ''

        const { type, title, message, confirmButtonText, cancelButtonText, errorMessage, moreInfo } = payload

        this.title = title
        this.moreInfo = moreInfo

        if (type === 'confirm-expected-input') {
          this.inputLabel = payload.inputLabel
          this.expectedInputValue = payload.expectedInputValue
        } else if (type === 'confirm-password') {
          this.inputLabel = $localize`Confirm your password`
          this.isPasswordInput = true
          this.errorMessage = errorMessage
        }

        this.confirmButtonText = confirmButtonText || $localize`Confirm`
        this.cancelButtonText = cancelButtonText || $localize`Cancel`

        this.html.toSimpleSafeHtmlWithLinks(message)
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

  cancel () {
    if (this.openedModal) this.openedModal.dismiss(CANCEL_BUTTON_MODAL_DISMISS)
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

    this.openedModal = this.modalService.open(this.confirmModal(), { centered: true })

    // Always send a response, so the caller promise is settled and does not catch the response of the next confirm modal
    this.openedModal.result
      .then(() => this.sendResponse('confirm-button'))
      .catch((dismissReason: unknown) => this.sendResponse(this.getCloseReason(dismissReason)))
  }

  private sendResponse (reason: ConfirmCloseReason) {
    this.confirmService.confirmResponse.next({ reason, value: this.inputValue })
  }

  private getCloseReason (dismissReason: unknown): ConfirmCloseReason {
    if (dismissReason === CANCEL_BUTTON_MODAL_DISMISS) return 'cancel-button'
    if (dismissReason === POP_STATE_MODAL_DISMISS) return 'pop-state'

    return 'dismiss'
  }
}
