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
  confirmResponse = new Subject<{ confirmed: boolean, value?: string }>()

  confirm (
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

    return firstValueFrom(this.extractConfirmed(this.confirmResponse.asObservable()))
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

  private extractConfirmed (obs: Observable<{ confirmed: boolean }>) {
    return obs.pipe(map(({ confirmed }) => confirmed))
  }
}
