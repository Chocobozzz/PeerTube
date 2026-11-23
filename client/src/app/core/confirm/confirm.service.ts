import { Injectable } from '@angular/core'
import { firstValueFrom, Subject } from 'rxjs'

type ConfirmOptions =
  & {
    title: string
    message: string
    errorMessage?: string
    moreInfo?: {
      title: string
      content: string
    }
    confirmButtonText?: string
    cancelButtonText?: string
  }
  & (
    | {
      type: 'confirm'
    }
    | {
      type: 'confirm-password'
      isIncorrectPassword?: boolean
    }
    | {
      type: 'confirm-expected-input'
      inputLabel?: string
      expectedInputValue?: string
    }
  )

// * confirm-button: the user clicked on the confirm button
// * cancel-button: the user clicked on the cancel button
// * dismiss: the user closed the modal using the cross, the escape key or a click outside
// * pop-state: the modal was closed because the user navigated in the browser history (back/forward button)
export type ConfirmCloseReason = 'confirm-button' | 'cancel-button' | 'dismiss' | 'pop-state'

@Injectable()
export class ConfirmService {
  showConfirm = new Subject<ConfirmOptions>()
  confirmResponse = new Subject<{ reason: ConfirmCloseReason, value?: string }>()

  async confirm (
    message: string,
    title = '',
    options: Partial<Pick<ConfirmOptions, 'confirmButtonText' | 'cancelButtonText' | 'moreInfo'>> = {}
  ) {
    const reason = await this.confirmWithReason(message, title, options)

    return reason === 'confirm-button'
  }

  // Same as `confirm()` but tells how the modal was closed
  async confirmWithReason (
    message: string,
    title = '',
    options: Partial<Pick<ConfirmOptions, 'confirmButtonText' | 'cancelButtonText' | 'moreInfo'>> = {}
  ) {
    this.showConfirm.next({
      type: 'confirm',
      title,
      message,
      confirmButtonText: options.confirmButtonText,
      moreInfo: options.moreInfo,
      cancelButtonText: options.cancelButtonText
    })

    const { reason } = await this.waitResponse()

    return reason
  }

  async confirmWithPassword (options: {
    message: string
    title?: string
    confirmButtonText?: string
    errorMessage?: string
  }) {
    const { message, title = '', confirmButtonText, errorMessage } = options
    this.showConfirm.next({ type: 'confirm-password', title, message, confirmButtonText, errorMessage })

    const { reason, value } = await this.waitResponse()

    return { confirmed: reason === 'confirm-button', reason, password: value }
  }

  async confirmWithExpectedInput (message: string, inputLabel: string, expectedInputValue: string, title = '', confirmButtonText?: string) {
    this.showConfirm.next({ type: 'confirm-expected-input', title, message, inputLabel, expectedInputValue, confirmButtonText })

    const { reason } = await this.waitResponse()

    return reason === 'confirm-button'
  }

  private waitResponse () {
    return firstValueFrom(this.confirmResponse)
  }
}
