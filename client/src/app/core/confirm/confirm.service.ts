import { Injectable } from '@angular/core'
import { Subject } from 'rxjs/Subject'
import 'rxjs/add/operator/first'

@Injectable()
export class ConfirmService {
  showConfirm = new Subject<{ title, message }>()
  confirmResponse = new Subject<boolean>()

  confirm (message = '', title = '') {
    this.showConfirm.next({ title, message })

    return this.confirmResponse.asObservable().first()
  }
}
