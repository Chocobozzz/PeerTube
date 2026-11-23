import { Injectable } from '@angular/core'
import { firstValueFrom, map, Observable, Subject } from 'rxjs'

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

@Injectable()
export class ConfirmService {
  showConfirm = new Subject<ConfirmOptions>()
  // cancelled is true only if the user clicked on the cancel button
  // (not if the modal was closed with the cross, the escape key or a click outside)
  confirmResponse = new Subject<{ confirmed: boolean, cancelled?: boolean, value?: string }>()

  confirm (
    message: string,
    title = '',
    options: Partial<Pick<ConfirmOptions, 'confirmButtonText' | 'cancelButtonText' | 'moreInfo'>> = {}
  ) {
    return firstValueFrom(this.extractConfirmed(this.showSimpleConfirm(message, title, options)))
  }

  // Same as confirm() but also tells if the user explicitly clicked on the cancel button
  confirmWithCancelInfo (
    message: string,
    title = '',
    options: Partial<Pick<ConfirmOptions, 'confirmButtonText' | 'cancelButtonText' | 'moreInfo'>> = {}
  ) {
    const obs = this.showSimpleConfirm(message, title, options)
      .pipe(map(({ confirmed, cancelled }) => ({ confirmed, cancelled: cancelled === true })))

    return firstValueFrom(obs)
  }

  confirmWithPassword (options: {
    message: string
    title?: string
    confirmButtonText?: string
    errorMessage?: string
  }) {
    const { message, title = '', confirmButtonText, errorMessage } = options
    this.showConfirm.next({ type: 'confirm-password', title, message, confirmButtonText, errorMessage })

    const obs = this.confirmResponse.asObservable()
      .pipe(map(({ confirmed, value }) => ({ confirmed, password: value })))

    return firstValueFrom(obs)
  }

  confirmWithExpectedInput (message: string, inputLabel: string, expectedInputValue: string, title = '', confirmButtonText?: string) {
    this.showConfirm.next({ type: 'confirm-expected-input', title, message, inputLabel, expectedInputValue, confirmButtonText })

    return firstValueFrom(this.extractConfirmed(this.confirmResponse.asObservable()))
  }

  private showSimpleConfirm (
    message: string,
    title: string,
    options: Partial<Pick<ConfirmOptions, 'confirmButtonText' | 'cancelButtonText' | 'moreInfo'>>
  ) {
    this.showConfirm.next({
      type: 'confirm',
      title,
      message,
      confirmButtonText: options.confirmButtonText,
      moreInfo: options.moreInfo,
      cancelButtonText: options.cancelButtonText
    })

    return this.confirmResponse.asObservable()
  }

  private extractConfirmed (obs: Observable<{ confirmed: boolean }>) {
    return obs.pipe(map(({ confirmed }) => confirmed))
  }
}
