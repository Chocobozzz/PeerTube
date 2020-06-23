import { Observable, ReplaySubject } from 'rxjs'
import { catchError, map, tap } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { RestExtractor } from '@app/core'
import { Account as ServerAccount } from '@shared/models'
import { environment } from '../../../../environments/environment'
import { Account } from './account.model'

@Injectable()
export class AccountService {
  static BASE_ACCOUNT_URL = environment.apiUrl + '/api/v1/accounts/'

  accountLoaded = new ReplaySubject<Account>(1)

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor
  ) {}

  getAccount (id: number | string): Observable<Account> {
    return this.authHttp.get<ServerAccount>(AccountService.BASE_ACCOUNT_URL + id)
               .pipe(
                 map(accountHash => new Account(accountHash)),
                 tap(account => this.accountLoaded.next(account)),
                 catchError(res => this.restExtractor.handleError(res))
               )
  }
}
