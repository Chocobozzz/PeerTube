import { Injectable } from '@angular/core'
import { Subject } from 'rxjs'

@Injectable()
export class HeaderService {
  private searchHidden = false

  private searchHiddenSubject = new Subject<boolean>()

  isSearchHidden () {
    return this.searchHidden
  }

  setSearchHidden (hidden: boolean) {
    this.searchHidden = hidden
    this.searchHiddenSubject.next(hidden)
  }

  getSearchHiddenObs () {
    return this.searchHiddenSubject.asObservable()
  }
}
