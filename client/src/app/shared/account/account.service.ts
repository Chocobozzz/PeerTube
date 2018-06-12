import { map, tap, catchError } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { environment } from '../../../environments/environment'
import { Observable, ReplaySubject } from 'rxjs'
import { Account } from '@app/shared/account/account.model'
import { RestExtractor } from '@app/shared/rest/rest-extractor.service'
import { HttpClient } from '@angular/common/http'
import { Account as ServerAccount } from '../../../../../shared/models/actors/account.model'

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
