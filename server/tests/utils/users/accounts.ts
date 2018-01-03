import { makeGetRequest } from '../requests/requests'

function getAccountsList (url: string, sort = '-createdAt', statusCodeExpected = 200) {
  const path = '/api/v1/accounts'

  return makeGetRequest({
    url,
    query: { sort },
    path,
    statusCodeExpected
  })
}

function getAccount (url: string, accountId: number | string, statusCodeExpected = 200) {
  const path = '/api/v1/accounts/' + accountId

  return makeGetRequest({
    url,
    path,
    statusCodeExpected
  })
}

// ---------------------------------------------------------------------------

export {
  getAccount,
  getAccountsList
}
