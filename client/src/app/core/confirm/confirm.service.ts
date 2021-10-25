import { firstValueFrom, Subject } from 'rxjs'
import { Injectable } from '@angular/core'

type ConfirmOptions = {
  title: string
  message: string
  inputLabel?: string
  expectedInputValue?: string
  confirmButtonText?: string
}

@Injectable()
export class ConfirmService {
  showConfirm = new Subject<ConfirmOptions>()
  confirmResponse = new Subject<boolean>()

  confirm (message: string, title = '', confirmButtonText?: string) {
    this.showConfirm.next({ title, message, confirmButtonText })

    return firstValueFrom(this.confirmResponse.asObservable())
  }

  confirmWithInput (message: string, inputLabel: string, expectedInputValue: string, title = '', confirmButtonText?: string) {
    this.showConfirm.next({ title, message, inputLabel, expectedInputValue, confirmButtonText })

    return firstValueFrom(this.confirmResponse.asObservable())
  }
}
