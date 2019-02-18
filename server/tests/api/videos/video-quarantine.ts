/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  getVideo,
  getVideoWithToken,
  getVideosList,
  getVideosListWithToken,
  createUser,
  userLogin,
  killallServers,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  flushTests,
  runServer,
  releaseVideoQuarantine,
  changeVideoOwnership,
  getVideoChangeOwnershipList,
  follow,
  waitJobs
} from '../../../../shared/utils'
import { UserRole } from '../../../../shared/models/users'

const expect = chai.expect

describe('Test video quarantine', function () {
  let server: ServerInfo
  let videoId: number
  let user1AccessToken: string
  let user2AccessToken: string
  let moderatorAccessToken: string
  let releasedVideosCount = 0
  const user1 = {
    username: 'user1',
    password: 'super password'
  }
  const user2 = {
    username: 'user2',
    password: 'superer password'
  }
  const moderator = {
    username: 'moderator',
    password: 'super password'
  }

  before(async function () {
    this.timeout(50000)

    await flushTests()

    const overrideConfig = {
      quarantine: {
        videos: {
          enabled: true
        }
      }
    }
    server = await runServer(1, overrideConfig)

    await setAccessTokensToServers([ server ])
    await createUser(server.url, server.accessToken, user1.username, user1.password)
    await createUser(server.url, server.accessToken, user2.username, user2.password)
    await createUser(
        server.url,
        server.accessToken,
        moderator.username,
        moderator.password,
        undefined,
        undefined,
        UserRole.MODERATOR
    )
    user1AccessToken = await userLogin(server, user1)
    user2AccessToken = await userLogin(server, user2)
    moderatorAccessToken = await userLogin(server, moderator)

  })

  it('Should upload a video for normal user', async function () {
    const res = await uploadVideo(server.url, user1AccessToken, {})
    videoId = res.body.video.id
  })

  it('Should get the quarantined video with moderator\'s token', async function () {
    const res = await getVideoWithToken(server.url, moderatorAccessToken, videoId)
    expect(res.body.quarantined).to.be.true
  })

  it('Should get the quarantined video with user\'s own token', async function () {
    const res = await getVideoWithToken(server.url, user1AccessToken, videoId)
    expect(res.body.quarantined).to.be.true
  })

  it('Should not list the quarantined video', async function () {
    const resVideos = await getVideosList(server.url)
    expect(resVideos.body.data.length).to.equal(releasedVideosCount)
    // even with user's token
    const resVideosWithToken = await getVideosListWithToken(server.url, user1AccessToken)
    expect(resVideosWithToken.body.data.length).to.equal(releasedVideosCount)
  })

  it('Should not get the quarantined video when not authenticated', async function () {
    await getVideo(server.url, videoId, 401)
  })

  it('Should not get the quarantined video when not owner/moderator', async function () {
    await getVideoWithToken(server.url, user2AccessToken, videoId, 403)
  })

  it('Should release video from quarantine', async function () {
    await releaseVideoQuarantine(server.url, moderatorAccessToken, videoId)
    releasedVideosCount++
  })

  it('Should now list the video', async function () {
    const resVideos = await getVideosList(server.url)
    expect(resVideos.body.data.length).to.equal(releasedVideosCount)
  })

  it('Should upload a video for moderator (has bypass quarantine right)', async function () {
    const res = await uploadVideo(server.url, moderatorAccessToken, {})
    videoId = res.body.video.id
    releasedVideosCount++
  })

  it('Should get the moderator\'s unquarantined video', async function () {
    const res = await getVideo(server.url, videoId)
    expect(res.body.quarantined).to.be.false
  })

  it('Should not allow change ownership request for quarantined video', async function () {
    const res = await uploadVideo(server.url, user1AccessToken, {})
    videoId = res.body.video.id

    await changeVideoOwnership(server.url, user1AccessToken, videoId, user2.username, 403)

    const resUser2ChangeOwnershipList = await getVideoChangeOwnershipList(server.url, user2AccessToken)

    expect(resUser2ChangeOwnershipList.body.total).to.equal(0)
    expect(resUser2ChangeOwnershipList.body.data).to.be.an('array')
    expect(resUser2ChangeOwnershipList.body.data.length).to.equal(0)
  })

  describe('Test following server', function () {
    let followingServer: ServerInfo

    before(async function () {
      this.timeout(5000)
      followingServer = await runServer(2)
      await setAccessTokensToServers([ followingServer ])
      await follow(followingServer.url, [ server.url ], followingServer.accessToken)
    })

    it('Should not propagate the quarantined video to following server', async function () {
      this.timeout(50000)

      const res = await uploadVideo(server.url, user1AccessToken, {})
      videoId = res.body.video.id
      await waitJobs([ server, followingServer ])

      const followingRes = await getVideosList(followingServer.url)
      const videos = followingRes.body.data
      expect(videos).to.be.an('array')
      expect(videos.length).to.equal(releasedVideosCount)
    })

    it('Should propagate the released video to following server', async function () {
      this.timeout(50000)

      await releaseVideoQuarantine(server.url, moderatorAccessToken, videoId)
      releasedVideosCount++
      await waitJobs([ server, followingServer ])

      const res = await getVideosList(followingServer.url)
      const videos = res.body.data
      expect(videos).to.be.an('array')
      expect(videos.length).to.equal(releasedVideosCount)
    })

    after(async function () {
      killallServers([ followingServer ])
    })
  })

  after(async function () {
    killallServers([ server ])
  })
})
