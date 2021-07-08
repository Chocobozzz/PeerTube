import { ResultList } from '@shared/models'
import { HttpStatusCode } from '../../core-utils/miscs/http-error-codes'
import { Account } from '../../models/actors'
import { AccountVideoRate, VideoRateType } from '../../models/videos'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class AccountsCommand extends AbstractCommand {

  list (options: OverrideCommandOptions & {
    sort?: string // default -createdAt
  } = {}) {
    const { sort = '-createdAt' } = options
    const path = '/api/v1/accounts'

    return this.getRequestBody<ResultList<Account>>({
      ...options,

      path,
      query: { sort },
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  get (options: OverrideCommandOptions & {
    accountName: string
  }) {
    const path = '/api/v1/accounts/' + options.accountName

    return this.getRequestBody<Account>({
      ...options,

      path,
      implicitToken: false,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  listRatings (options: OverrideCommandOptions & {
    accountName: string
    rating?: VideoRateType
  }) {
    const { rating, accountName } = options
    const path = '/api/v1/accounts/' + accountName + '/ratings'

    const query = { rating }

    return this.getRequestBody<ResultList<AccountVideoRate>>({
      ...options,

      path,
      query,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
