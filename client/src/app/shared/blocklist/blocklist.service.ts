import { Injectable } from '@angular/core'
import { environment } from '../../../environments/environment'
import { HttpClient, HttpParams } from '@angular/common/http'
import { RestExtractor, RestPagination, RestService } from '../rest'
import { SortMeta } from 'primeng/api'
import { catchError, map } from 'rxjs/operators'
import { AccountBlock as AccountBlockServer, ResultList, ServerBlock } from '../../../../../shared'
import { Account } from '@app/shared/account/account.model'
import { AccountBlock } from '@app/shared/blocklist/account-block.model'

@Injectable()
export class BlocklistService {
  static BASE_USER_BLOCKLIST_URL = environment.apiUrl + '/api/v1/users/me/blocklist'

  constructor (
    private authHttp: HttpClient,
    private restExtractor: RestExtractor,
    private restService: RestService
  ) { }

  /*********************** User -> Account blocklist ***********************/

  getUserAccountBlocklist (pagination: RestPagination, sort: SortMeta) {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<AccountBlock>>(BlocklistService.BASE_USER_BLOCKLIST_URL + '/accounts', { params })
               .pipe(
                 map(res => this.restExtractor.convertResultListDateToHuman(res)),
                 map(res => this.restExtractor.applyToResultListData(res, this.formatAccountBlock.bind(this))),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  blockAccountByUser (account: Account) {
    const body = { accountName: account.nameWithHost }

    return this.authHttp.post(BlocklistService.BASE_USER_BLOCKLIST_URL + '/accounts', body)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  unblockAccountByUser (account: Account) {
    const path = BlocklistService.BASE_USER_BLOCKLIST_URL + '/accounts/' + account.nameWithHost

    return this.authHttp.delete(path)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  /*********************** User -> Server blocklist ***********************/

  getUserServerBlocklist (pagination: RestPagination, sort: SortMeta) {
    let params = new HttpParams()
    params = this.restService.addRestGetParams(params, pagination, sort)

    return this.authHttp.get<ResultList<ServerBlock>>(BlocklistService.BASE_USER_BLOCKLIST_URL + '/servers', { params })
               .pipe(
                 map(res => this.restExtractor.convertResultListDateToHuman(res)),
                 catchError(err => this.restExtractor.handleError(err))
               )
  }

  blockServerByUser (host: string) {
    const body = { host }

    return this.authHttp.post(BlocklistService.BASE_USER_BLOCKLIST_URL + '/servers', body)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  unblockServerByUser (host: string) {
    const path = BlocklistService.BASE_USER_BLOCKLIST_URL + '/servers/' + host

    return this.authHttp.delete(path)
               .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  private formatAccountBlock (accountBlock: AccountBlockServer) {
    return new AccountBlock(accountBlock)
  }
}
