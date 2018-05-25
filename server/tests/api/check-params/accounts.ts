/* tslint:disable:no-unused-expression */

import 'mocha'

import { flushTests, killallServers, runServer, ServerInfo } from '../../utils'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '../../utils/requests/check-api-params'
import { getAccount } from '../../utils/users/accounts'

describe('Test users API validators', function () {
  const path = '/api/v1/accounts/'
  let server: ServerInfo

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    await flushTests()

    server = await runServer(1)
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
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
