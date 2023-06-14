/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import {
  cleanupTests,
  createSingleServer,
  VideoPasswordsCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar
} from '@shared/server-commands'
import { VideoPrivacy } from '@shared/models'

describe('Test video passwords', function () {
  let server: PeerTubeServer
  let videoUUID: string

  let userAccessTokenServer1: string

  let videoPasswords: string[] = []
  let command: VideoPasswordsCommand

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    for (let i = 0; i < 10; i++) {
      videoPasswords.push(`password ${i + 1}`)
    }
    const { uuid } = await server.videos.upload({ attributes: { privacy: VideoPrivacy.PASSWORD_PROTECTED, videoPasswords } })
    videoUUID = uuid

    await setDefaultChannelAvatar(server)
    await setDefaultAccountAvatar(server)

    userAccessTokenServer1 = await server.users.generateUserAndToken('user1')
    await setDefaultChannelAvatar(server, 'user1_channel')
    await setDefaultAccountAvatar(server, userAccessTokenServer1)

    command = server.videoPasswords
  })

  it('Should list video passwords', async function () {
    const body = await command.list({ videoId: videoUUID })

    expect(body.total).to.equal(10)
    expect(body.data).to.be.an('array')
    expect(body.data).to.have.lengthOf(10)
  })

  it('Should filter passwords on this video', async function () {
    const body = await command.list({ videoId: videoUUID, count: 2, start: 3, sort: 'createdAt' })

    expect(body.total).to.equal(10)
    expect(body.data).to.be.an('array')
    expect(body.data).to.have.lengthOf(2)
    expect(body.data[0].password).to.equal('password 4')
    expect(body.data[1].password).to.equal('password 5')
  })

  it('Should update password for this video', async function () {
    videoPasswords = [ 'my super new password 1', 'my super new password 2' ]

    await command.updateAll({ videoId: videoUUID, passwords: videoPasswords })
    const body = await command.list({ videoId: videoUUID })
    expect(body.total).to.equal(2)
    expect(body.data).to.be.an('array')
    expect(body.data).to.have.lengthOf(2)
    expect(body.data[0].password).to.equal('my super new password 2')
    expect(body.data[1].password).to.equal('my super new password 1')
  })

  it('Should delete one password', async function () {
    {
      const body = await command.list({ videoId: videoUUID })
      expect(body.total).to.equal(2)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(2)
      await command.remove({ id: body.data[0].id, videoId: videoUUID })
    }
    {
      const body = await command.list({ videoId: videoUUID })

      expect(body.total).to.equal(1)
      expect(body.data).to.be.an('array')
      expect(body.data).to.have.lengthOf(1)
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
