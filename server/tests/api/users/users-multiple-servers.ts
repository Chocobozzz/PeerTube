/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { Account } from '../../../../shared/models/actors'
import { doubleFollow, flushAndRunMultipleServers, wait } from '../../utils'
import {
  flushTests, getMyUserInformation, killallServers, ServerInfo, testVideoImage, updateMyAvatar,
  uploadVideo
} from '../../utils/index'
import { getAccount, getAccountsList } from '../../utils/users/accounts'
import { setAccessTokensToServers } from '../../utils/users/login'

const expect = chai.expect

describe('Test users with multiple servers', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
    // Server 1 and server 3 follow each other
    await doubleFollow(servers[0], servers[2])
    // Server 2 and server 3 follow each other
    await doubleFollow(servers[1], servers[2])

    // The root user of server 1 is propagated to servers 2 and 3
    await uploadVideo(servers[0].url, servers[0].accessToken, {})

    await wait(5000)
  })

  it('Should be able to update my avatar', async function () {
    this.timeout(10000)

    const fixture = 'avatar2.png'

    await updateMyAvatar({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      fixture
    })

    const res = await getMyUserInformation(servers[0].url, servers[0].accessToken)
    const user = res.body

    const test = await testVideoImage(servers[0].url, 'avatar2-resized', user.account.avatar.path, '.png')
    expect(test).to.equal(true)

    await wait(5000)
  })

  it('Should have updated my avatar on other servers too', async function () {
    for (const server of servers) {
      const resAccounts = await getAccountsList(server.url, '-createdAt')

      const rootServer1List = resAccounts.body.data.find(a => a.name === 'root' && a.host === 'localhost:9001') as Account
      expect(rootServer1List).not.to.be.undefined

      const resAccount = await getAccount(server.url, rootServer1List.id)
      const rootServer1Get = resAccount.body as Account
      expect(rootServer1Get.name).to.equal('root')
      expect(rootServer1Get.host).to.equal('localhost:9001')

      const test = await testVideoImage(server.url, 'avatar2-resized', rootServer1Get.avatar.path, '.png')
      expect(test).to.equal(true)
    }
  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this[ 'ok' ]) {
      await flushTests()
    }
  })
})
