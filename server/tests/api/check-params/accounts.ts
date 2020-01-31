/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'

import { cleanupTests, flushAndRunServer, ServerInfo } from '../../../../shared/extra-utils'
import {
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination
} from '../../../../shared/extra-utils/requests/check-api-params'
import { getAccount } from '../../../../shared/extra-utils/users/accounts'

describe('Test accounts API validators', function () {
  const path = '/api/v1/accounts/'
  let server: ServerInfo

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
  })

  describe('When listing accounts', function () {
    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, server.accessToken)
    })
  })

  describe('When getting an account', function () {
    it('Should return 404 with a non existing name', async function () {
      await getAccount(server.url, 'arfaze', 404)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
