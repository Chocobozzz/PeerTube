/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { makeGetRequest, makeDeleteRequest, makePostBodyRequest } from '../requests/requests'

function getAccountBlocklistByAccount (
  url: string,
  token: string,
  start: number,
  count: number,
  sort = '-createdAt',
  statusCodeExpected = 200
) {
  const path = '/api/v1/users/me/blocklist/accounts'

  return makeGetRequest({
    url,
    token,
    query: { start, count, sort },
    path,
    statusCodeExpected
  })
}

function addAccountToAccountBlocklist (url: string, token: string, accountToBlock: string, statusCodeExpected = 204) {
  const path = '/api/v1/users/me/blocklist/accounts'

  return makePostBodyRequest({
    url,
    path,
    token,
    fields: {
      accountName: accountToBlock
    },
    statusCodeExpected
  })
}

function removeAccountFromAccountBlocklist (url: string, token: string, accountToUnblock: string, statusCodeExpected = 204) {
  const path = '/api/v1/users/me/blocklist/accounts/' + accountToUnblock

  return makeDeleteRequest({
    url,
    path,
    token,
    statusCodeExpected
  })
}

function getServerBlocklistByAccount (
  url: string,
  token: string,
  start: number,
  count: number,
  sort = '-createdAt',
  statusCodeExpected = 200
) {
  const path = '/api/v1/users/me/blocklist/servers'

  return makeGetRequest({
    url,
    token,
    query: { start, count, sort },
    path,
    statusCodeExpected
  })
}

function addServerToAccountBlocklist (url: string, token: string, serverToBlock: string, statusCodeExpected = 204) {
  const path = '/api/v1/users/me/blocklist/servers'

  return makePostBodyRequest({
    url,
    path,
    token,
    fields: {
      host: serverToBlock
    },
    statusCodeExpected
  })
}

function removeServerFromAccountBlocklist (url: string, token: string, serverToBlock: string, statusCodeExpected = 204) {
  const path = '/api/v1/users/me/blocklist/servers/' + serverToBlock

  return makeDeleteRequest({
    url,
    path,
    token,
    statusCodeExpected
  })
}

function getAccountBlocklistByServer (
  url: string,
  token: string,
  start: number,
  count: number,
  sort = '-createdAt',
  statusCodeExpected = 200
) {
  const path = '/api/v1/server/blocklist/accounts'

  return makeGetRequest({
    url,
    token,
    query: { start, count, sort },
    path,
    statusCodeExpected
  })
}

function addAccountToServerBlocklist (url: string, token: string, accountToBlock: string, statusCodeExpected = 204) {
  const path = '/api/v1/server/blocklist/accounts'

  return makePostBodyRequest({
    url,
    path,
    token,
    fields: {
      accountName: accountToBlock
    },
    statusCodeExpected
  })
}

function removeAccountFromServerBlocklist (url: string, token: string, accountToUnblock: string, statusCodeExpected = 204) {
  const path = '/api/v1/server/blocklist/accounts/' + accountToUnblock

  return makeDeleteRequest({
    url,
    path,
    token,
    statusCodeExpected
  })
}

function getServerBlocklistByServer (
  url: string,
  token: string,
  start: number,
  count: number,
  sort = '-createdAt',
  statusCodeExpected = 200
) {
  const path = '/api/v1/server/blocklist/servers'

  return makeGetRequest({
    url,
    token,
    query: { start, count, sort },
    path,
    statusCodeExpected
  })
}

function addServerToServerBlocklist (url: string, token: string, serverToBlock: string, statusCodeExpected = 204) {
  const path = '/api/v1/server/blocklist/servers'

  return makePostBodyRequest({
    url,
    path,
    token,
    fields: {
      host: serverToBlock
    },
    statusCodeExpected
  })
}

function removeServerFromServerBlocklist (url: string, token: string, serverToBlock: string, statusCodeExpected = 204) {
  const path = '/api/v1/server/blocklist/servers/' + serverToBlock

  return makeDeleteRequest({
    url,
    path,
    token,
    statusCodeExpected
  })
}

// ---------------------------------------------------------------------------

export {
  getAccountBlocklistByAccount,
  addAccountToAccountBlocklist,
  removeAccountFromAccountBlocklist,
  getServerBlocklistByAccount,
  addServerToAccountBlocklist,
  removeServerFromAccountBlocklist,

  getAccountBlocklistByServer,
  addAccountToServerBlocklist,
  removeAccountFromServerBlocklist,
  getServerBlocklistByServer,
  addServerToServerBlocklist,
  removeServerFromServerBlocklist
}
