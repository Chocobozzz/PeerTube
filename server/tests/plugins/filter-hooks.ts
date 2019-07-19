/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { cleanupTests, flushAndRunServer, ServerInfo } from '../../../shared/extra-utils/server/servers'
import { setAccessTokensToServers } from '../../../shared/extra-utils'

const expect = chai.expect

describe('Test plugin filter hooks', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)
    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])
  })

  it('Should execute ', async function () {
    // empty
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
