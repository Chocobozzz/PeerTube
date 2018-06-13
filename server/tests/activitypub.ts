/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { flushTests, killallServers, makeActivityPubGetRequest, runServer, ServerInfo, setAccessTokensToServers } from './utils'

const expect = chai.expect

describe('Test activitypub', function () {
  let server: ServerInfo = null

  before(async function () {
    this.timeout(30000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])
  })

  it('Should return the account object', async function () {
    const res = await makeActivityPubGetRequest(server.url, '/accounts/root')
    const object = res.body

    expect(object.type).to.equal('Person')
    expect(object.id).to.equal('http://localhost:9001/accounts/root')
    expect(object.name).to.equal('root')
    expect(object.preferredUsername).to.equal('root')
  })

  after(async function () {
    killallServers([ server ])
  })
})
