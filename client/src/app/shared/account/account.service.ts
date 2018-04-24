import { Injectable } from '@angular/core'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/map'
import { environment } from '../../../environments/environment'
import { Observable } from 'rxjs/Observable'
import { Account } from '@app/shared/account/account.model'
import { RestExtractor } from '@app/shared/rest/rest-extractor.service'
import { RestService } from '@app/shared/rest/rest.service'
import { HttpClient } from '@angular/common/http'
import { Account as ServerAccount } from '../../../../../shared/models/actors/account.model'
import { ReplaySubject } from 'rxjs/ReplaySubject'

@Injectable()
export class AccountService {
  static BASE_ACCOUNT_URL = environment.apiUrl + '/api/v1/accounts/'

  accountLoaded = new ReplaySubject<Account>(1)

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) {}

  getAccount (id: number): Observable<Account> {
    return this.authHttp.get<ServerAccount>(AccountService.BASE_ACCOUNT_URL + id)
               .map(accountHash => new Account(accountHash))
               .do(account => this.accountLoaded.next(account))
               .catch((res) => this.restExtractor.handleError(res))
  }
}
