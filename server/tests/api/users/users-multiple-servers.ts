/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import {
  checkActorFilesWereRemoved,
  checkTmpIsEmpty,
  checkVideoFilesWereRemoved,
  saveVideoInServers,
  testImage
} from '@server/tests/shared'
import { MyUser } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultChannelAvatar,
  waitJobs
} from '@shared/server-commands'

describe('Test users with multiple servers', function () {
  let servers: PeerTubeServer[] = []

  let user: MyUser
  let userId: number

  let videoUUID: string
  let userAccessToken: string
  let userAvatarFilenames: string[]

  before(async function () {
    this.timeout(120_000)

    servers = await createMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultChannelAvatar(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
    // Server 1 and server 3 follow each other
    await doubleFollow(servers[0], servers[2])
    // Server 2 and server 3 follow each other
    await doubleFollow(servers[1], servers[2])

    // The root user of server 1 is propagated to servers 2 and 3
    await servers[0].videos.upload()

    {
      const username = 'user1'
      const created = await servers[0].users.create({ username })
      userId = created.id
      userAccessToken = await servers[0].login.getAccessToken(username)
    }

    {
      const { uuid } = await servers[0].videos.upload({ token: userAccessToken })
      videoUUID = uuid

      await waitJobs(servers)

      await saveVideoInServers(servers, videoUUID)
    }
  })

  it('Should be able to update my display name', async function () {
    this.timeout(10000)

    await servers[0].users.updateMe({ displayName: 'my super display name' })

    user = await servers[0].users.getMyInfo()
    expect(user.account.displayName).to.equal('my super display name')

    await waitJobs(servers)
  })

  it('Should be able to update my description', async function () {
    this.timeout(10_000)

    await servers[0].users.updateMe({ description: 'my super description updated' })

    user = await servers[0].users.getMyInfo()
    expect(user.account.displayName).to.equal('my super display name')
    expect(user.account.description).to.equal('my super description updated')

    await waitJobs(servers)
  })

  it('Should be able to update my avatar', async function () {
    this.timeout(10_000)

    const fixture = 'avatar2.png'

    await servers[0].users.updateMyAvatar({ fixture })

    user = await servers[0].users.getMyInfo()
    userAvatarFilenames = user.account.avatars.map(({ path }) => path)

    for (const avatar of user.account.avatars) {
      await testImage(servers[0].url, `avatar2-resized-${avatar.width}x${avatar.width}`, avatar.path, '.png')
    }

    await waitJobs(servers)
  })

  it('Should have updated my profile on other servers too', async function () {
    let createdAt: string | Date

    for (const server of servers) {
      const body = await server.accounts.list({ sort: '-createdAt' })

      const resList = body.data.find(a => a.name === 'root' && a.host === 'localhost:' + servers[0].port)
      expect(resList).not.to.be.undefined

      const account = await server.accounts.get({ accountName: resList.name + '@' + resList.host })

      if (!createdAt) createdAt = account.createdAt

      expect(account.name).to.equal('root')
      expect(account.host).to.equal('localhost:' + servers[0].port)
      expect(account.displayName).to.equal('my super display name')
      expect(account.description).to.equal('my super description updated')
      expect(createdAt).to.equal(account.createdAt)

      if (server.serverNumber === 1) {
        expect(account.userId).to.be.a('number')
      } else {
        expect(account.userId).to.be.undefined
      }

      for (const avatar of account.avatars) {
        await testImage(server.url, `avatar2-resized-${avatar.width}x${avatar.width}`, avatar.path, '.png')
      }
    }
  })

  it('Should list account videos', async function () {
    for (const server of servers) {
      const { total, data } = await server.videos.listByAccount({ handle: 'user1@localhost:' + servers[0].port })

      expect(total).to.equal(1)
      expect(data).to.be.an('array')
      expect(data).to.have.lengthOf(1)
      expect(data[0].uuid).to.equal(videoUUID)
    }
  })

  it('Should search through account videos', async function () {
    this.timeout(10_000)

    const created = await servers[0].videos.upload({ token: userAccessToken, attributes: { name: 'Kami no chikara' } })

    await waitJobs(servers)

    for (const server of servers) {
      const { total, data } = await server.videos.listByAccount({ handle: 'user1@localhost:' + servers[0].port, search: 'Kami' })

      expect(total).to.equal(1)
      expect(data).to.be.an('array')
      expect(data).to.have.lengthOf(1)
      expect(data[0].uuid).to.equal(created.uuid)
    }
  })

  it('Should remove the user', async function () {
    this.timeout(10_000)

    for (const server of servers) {
      const body = await server.accounts.list({ sort: '-createdAt' })

      const accountDeleted = body.data.find(a => a.name === 'user1' && a.host === 'localhost:' + servers[0].port)
      expect(accountDeleted).not.to.be.undefined

      const { data } = await server.channels.list()
      const videoChannelDeleted = data.find(a => a.displayName === 'Main user1 channel' && a.host === 'localhost:' + servers[0].port)
      expect(videoChannelDeleted).not.to.be.undefined
    }

    await servers[0].users.remove({ userId })

    await waitJobs(servers)

    for (const server of servers) {
      const body = await server.accounts.list({ sort: '-createdAt' })

      const accountDeleted = body.data.find(a => a.name === 'user1' && a.host === 'localhost:' + servers[0].port)
      expect(accountDeleted).to.be.undefined

      const { data } = await server.channels.list()
      const videoChannelDeleted = data.find(a => a.name === 'Main user1 channel' && a.host === 'localhost:' + servers[0].port)
      expect(videoChannelDeleted).to.be.undefined
    }
  })

  it('Should not have actor files', async () => {
    for (const server of servers) {
      for (const userAvatarFilename of userAvatarFilenames) {
        await checkActorFilesWereRemoved(userAvatarFilename, server.internalServerNumber)
      }
    }
  })

  it('Should not have video files', async () => {
    for (const server of servers) {
      await checkVideoFilesWereRemoved({ server, video: server.store.videoDetails })
    }
  })

  it('Should have an empty tmp directory', async function () {
    for (const server of servers) {
      await checkTmpIsEmpty(server)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
