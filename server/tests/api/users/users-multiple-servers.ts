/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { Account } from '../../../../shared/models/actors'
import {
  checkVideoFilesWereRemoved,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  getAccountVideos,
  getVideoChannelsList,
  removeUser,
  updateMyUser,
  userLogin,
  wait
} from '../../utils'
import { flushTests, getMyUserInformation, killallServers, ServerInfo, testImage, updateMyAvatar, uploadVideo } from '../../utils/index'
import { checkActorFilesWereRemoved, getAccount, getAccountsList } from '../../utils/users/accounts'
import { setAccessTokensToServers } from '../../utils/users/login'
import { User } from '../../../../shared/models/users'
import { VideoChannel } from '../../../../shared/models/videos'

const expect = chai.expect

describe('Test users with multiple servers', function () {
  let servers: ServerInfo[] = []
  let user: User
  let userAccountName: string
  let userVideoChannelUUID: string
  let userId: number
  let videoUUID: string
  let userAccessToken: string

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

    {
      const user = {
        username: 'user1',
        password: 'password'
      }
      const res = await createUser(servers[ 0 ].url, servers[ 0 ].accessToken, user.username, user.password)
      userId = res.body.user.id
      userAccessToken = await userLogin(servers[ 0 ], user)
    }

    {
      const res = await getMyUserInformation(servers[0].url, userAccessToken)
      userAccountName = res.body.account.name + '@' + res.body.account.host
    }

    {
      const res = await getMyUserInformation(servers[ 0 ].url, servers[ 0 ].accessToken)
      const user: User = res.body
      userVideoChannelUUID = user.videoChannels[0].uuid
    }

    {
      const resVideo = await uploadVideo(servers[ 0 ].url, userAccessToken, {})
      videoUUID = resVideo.body.video.uuid
    }

    await wait(5000)
  })

  it('Should be able to update my display name', async function () {
    this.timeout(10000)

    await updateMyUser({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      displayName: 'my super display name'
    })

    const res = await getMyUserInformation(servers[0].url, servers[0].accessToken)
    user = res.body
    expect(user.account.displayName).to.equal('my super display name')

    await wait(5000)
  })

  it('Should be able to update my description', async function () {
    this.timeout(10000)

    await updateMyUser({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      description: 'my super description updated'
    })

    const res = await getMyUserInformation(servers[0].url, servers[0].accessToken)
    user = res.body
    expect(user.account.displayName).to.equal('my super display name')
    expect(user.account.description).to.equal('my super description updated')

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
    user = res.body

    await testImage(servers[0].url, 'avatar2-resized', user.account.avatar.path, '.png')

    await wait(5000)
  })

  it('Should have updated my profile on other servers too', async function () {
    for (const server of servers) {
      const resAccounts = await getAccountsList(server.url, '-createdAt')

      const rootServer1List = resAccounts.body.data.find(a => a.name === 'root' && a.host === 'localhost:9001') as Account
      expect(rootServer1List).not.to.be.undefined

      const resAccount = await getAccount(server.url, rootServer1List.name + '@' + rootServer1List.host)
      const rootServer1Get = resAccount.body as Account
      expect(rootServer1Get.name).to.equal('root')
      expect(rootServer1Get.host).to.equal('localhost:9001')
      expect(rootServer1Get.displayName).to.equal('my super display name')
      expect(rootServer1Get.description).to.equal('my super description updated')

      await testImage(server.url, 'avatar2-resized', rootServer1Get.avatar.path, '.png')
    }
  })

  it('Should list account videos', async function () {
    for (const server of servers) {
      const res = await getAccountVideos(server.url, server.accessToken, userAccountName, 0, 5)

      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(1)
      expect(res.body.data[0].uuid).to.equal(videoUUID)
    }
  })

  it('Should remove the user', async function () {
    this.timeout(10000)

    for (const server of servers) {
      const resAccounts = await getAccountsList(server.url, '-createdAt')

      const accountDeleted = resAccounts.body.data.find(a => a.name === 'user1' && a.host === 'localhost:9001') as Account
      expect(accountDeleted).not.to.be.undefined

      const resVideoChannels = await getVideoChannelsList(server.url, 0, 10)
      const videoChannelDeleted = resVideoChannels.body.data.find(a => {
        return a.displayName === 'Default user1 channel' && a.host === 'localhost:9001'
      }) as VideoChannel
      expect(videoChannelDeleted).not.to.be.undefined
    }

    await removeUser(servers[0].url, userId, servers[0].accessToken)

    await wait(5000)

    for (const server of servers) {
      const resAccounts = await getAccountsList(server.url, '-createdAt')

      const accountDeleted = resAccounts.body.data.find(a => a.name === 'user1' && a.host === 'localhost:9001') as Account
      expect(accountDeleted).to.be.undefined

      const resVideoChannels = await getVideoChannelsList(server.url, 0, 10)
      const videoChannelDeleted = resVideoChannels.body.data.find(a => {
        return a.name === 'Default user1 channel' && a.host === 'localhost:9001'
      }) as VideoChannel
      expect(videoChannelDeleted).to.be.undefined
    }
  })

  it('Should not have actor files', async () => {
    for (const server of servers) {
      await checkActorFilesWereRemoved(userAccountName, server.serverNumber)
      await checkActorFilesWereRemoved(userVideoChannelUUID, server.serverNumber)
    }
  })

  it('Should not have video files', async () => {
    for (const server of servers) {
      await checkVideoFilesWereRemoved(videoUUID, server.serverNumber)
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
