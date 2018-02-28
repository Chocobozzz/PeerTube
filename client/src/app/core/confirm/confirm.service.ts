import { Injectable } from '@angular/core'
import { Subject } from 'rxjs/Subject'
import 'rxjs/add/operator/first'
import 'rxjs/add/operator/toPromise'

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

    return this.confirmResponse.asObservable().first().toPromise()
  }

  confirmWithInput (message: string, inputLabel: string, expectedInputValue: string, title = '', confirmButtonText?: string) {
    this.showConfirm.next({ title, message, inputLabel, expectedInputValue, confirmButtonText })

    return this.confirmResponse.asObservable().first().toPromise()
  }
}
