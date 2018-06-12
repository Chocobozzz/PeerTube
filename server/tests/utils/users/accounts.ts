/* tslint:disable:no-unused-expression */

import { expect } from 'chai'
import { existsSync } from 'fs'
import { join } from 'path'
import { Account } from '../../../../shared/models/actors'
import { readdirPromise } from '../../../helpers/core-utils'
import { root } from '../index'
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

function getAccount (url: string, accountName: string, statusCodeExpected = 200) {
  const path = '/api/v1/accounts/' + accountName

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

async function checkActorFilesWereRemoved (actorUUID: string, serverNumber: number) {
  const testDirectory = 'test' + serverNumber

  for (const directory of [ 'avatars' ]) {
    const directoryPath = join(root(), testDirectory, directory)

    const directoryExists = existsSync(directoryPath)
    expect(directoryExists).to.be.true

    const files = await readdirPromise(directoryPath)
    for (const file of files) {
      expect(file).to.not.contain(actorUUID)
    }
  }
}

// ---------------------------------------------------------------------------

export {
  getAccount,
  expectAccountFollows,
  getAccountsList,
  checkActorFilesWereRemoved
}
