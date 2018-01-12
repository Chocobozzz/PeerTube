import { expect } from 'chai'
import { Account } from '../../../../shared/models/actors'
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

async function expectAccountFollows (url: string, nameWithDomain: string, followersCount: number, followingCount: number) {
  const res = await getAccountsList(url)
  const account = res.body.data.find((a: Account) => a.name + '@' + a.host === nameWithDomain)

  const message = `${nameWithDomain} on ${url}`
  expect(account.followersCount).to.equal(followersCount, message)
  expect(account.followingCount).to.equal(followingCount, message)
}

// ---------------------------------------------------------------------------

export {
  getAccount,
  expectAccountFollows,
  getAccountsList
}
