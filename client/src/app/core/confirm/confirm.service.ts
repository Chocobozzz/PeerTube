import { Injectable } from '@angular/core'
import { Subject } from 'rxjs/Subject'
import 'rxjs/add/operator/first'
import 'rxjs/add/operator/toPromise'

@Injectable()
export class ConfirmService {
  showConfirm = new Subject<{ title: string, message: string, inputLabel?: string, expectedInputValue?: string }>()
  confirmResponse = new Subject<boolean>()

  confirm (message: string, title = '') {
    this.showConfirm.next({ title, message })

    return this.confirmResponse.asObservable().first().toPromise()
  }

  confirmWithInput (message: string, inputLabel: string, expectedInputValue: string, title = '') {
    this.showConfirm.next({ title, message, inputLabel, expectedInputValue })

    return this.confirmResponse.asObservable().first().toPromise()
  }
}
