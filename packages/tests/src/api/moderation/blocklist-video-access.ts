/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, UserRole } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeHTMLRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test access to videos of accounts and servers muted by the instance', function () {
  let servers: PeerTubeServer[]

  let userToken: string
  let mutedUserToken: string
  let moderatorToken: string

  const remoteVideo = { name: 'remote video', uuid: '' }
  const localVideo = { name: 'muted user video', uuid: '' }

  async function checkAccess (uuid: string, tokens: string[]) {
    for (const token of tokens) {
      await servers[0].videos.get({ id: uuid, token })
    }
  }

  // Check the API, the watch page and the embed for anonymous users and regular users
  async function checkPublicAccess (video: { uuid: string, name: string }, accessible: boolean) {
    const { uuid, name } = video
    const expectedStatus = accessible ? HttpStatusCode.OK_200 : HttpStatusCode.NOT_FOUND_404

    for (const token of [ undefined, userToken ]) {
      await servers[0].videos.get({ id: uuid, token, expectedStatus })
    }

    const watchPage = await makeHTMLRequest(servers[0].url, '/w/' + uuid, expectedStatus)
    const embed = await makeHTMLRequest(servers[0].url, '/videos/embed/' + uuid)

    for (const res of [ watchPage, embed ]) {
      if (accessible) expect(res.text).to.contain(name)
      else expect(res.text).to.not.contain(name)
    }
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    userToken = await servers[0].users.generateUserAndToken('user')
    mutedUserToken = await servers[0].users.generateUserAndToken('muted_user')
    moderatorToken = await servers[0].users.generateUserAndToken('moderator', UserRole.MODERATOR)

    remoteVideo.uuid = (await servers[1].videos.quickUpload({ name: remoteVideo.name })).uuid
    localVideo.uuid = (await servers[0].videos.quickUpload({ name: localVideo.name, token: mutedUserToken })).uuid

    await waitJobs(servers)
  })

  it('Should access videos without mutes', async function () {
    await checkPublicAccess(remoteVideo, true)
    await checkPublicAccess(localVideo, true)
  })

  describe('Server muted by the instance', function () {
    before(async function () {
      await servers[0].blocklist.addToServerBlocklist({ server: servers[1].host })
    })

    it('Should not access videos of the muted server', async function () {
      await checkPublicAccess(remoteVideo, false)
    })

    it('Should access videos of the muted server as moderator or admin', async function () {
      await checkAccess(remoteVideo.uuid, [ moderatorToken, servers[0].accessToken ])
    })

    it('Should access videos of other servers', async function () {
      await checkPublicAccess(localVideo, true)
    })

    after(async function () {
      await servers[0].blocklist.removeFromServerBlocklist({ server: servers[1].host })
    })
  })

  describe('Account muted by the instance', function () {
    before(async function () {
      await servers[0].blocklist.addToServerBlocklist({ account: 'muted_user' })
    })

    it('Should not access videos of the muted account', async function () {
      await checkPublicAccess(localVideo, false)
    })

    it('Should access videos of the muted account as owner, moderator or admin', async function () {
      await checkAccess(localVideo.uuid, [ mutedUserToken, moderatorToken, servers[0].accessToken ])
    })

    after(async function () {
      await servers[0].blocklist.removeFromServerBlocklist({ account: 'muted_user' })
    })
  })

  it('Should access videos after the instance unmute, even if muted by the user', async function () {
    await servers[0].blocklist.addToMyBlocklist({ token: userToken, server: servers[1].host })
    await servers[0].blocklist.addToMyBlocklist({ token: userToken, account: 'muted_user' })

    await checkPublicAccess(remoteVideo, true)
    await checkPublicAccess(localVideo, true)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
