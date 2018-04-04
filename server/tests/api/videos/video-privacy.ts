/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { VideoPrivacy } from '../../../../shared/models/videos/video-privacy.enum'
import {
  flushAndRunMultipleServers,
  flushTests,
  getVideosList,
  killallServers,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  wait
} from '../../utils/index'
import { doubleFollow } from '../../utils/server/follows'
import { userLogin } from '../../utils/users/login'
import { createUser } from '../../utils/users/users'
import { getMyVideos, getVideo, getVideoWithToken, updateVideo } from '../../utils/videos/videos'

const expect = chai.expect

describe('Test video privacy', function () {
  let servers: ServerInfo[] = []
  let privateVideoId: number
  let privateVideoUUID: string
  let unlistedVideoUUID: string
  let now: number

  before(async function () {
    this.timeout(50000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  it('Should upload a private video on server 1', async function () {
    this.timeout(10000)

    const attributes = {
      privacy: VideoPrivacy.PRIVATE
    }
    await uploadVideo(servers[0].url, servers[0].accessToken, attributes)

    await wait(5000)
  })

  it('Should not have this private video on server 2', async function () {
    const res = await getVideosList(servers[1].url)

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.have.lengthOf(0)
  })

  it('Should list my (private) videos', async function () {
    const res = await getMyVideos(servers[0].url, servers[0].accessToken, 0, 1)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.have.lengthOf(1)

    privateVideoId = res.body.data[0].id
    privateVideoUUID = res.body.data[0].uuid
  })

  it('Should not be able to watch this video with non authenticated user', async function () {
    await getVideo(servers[0].url, privateVideoUUID, 401)
  })

  it('Should not be able to watch this private video with another user', async function () {
    const user = {
      username: 'hello',
      password: 'super password'
    }
    await createUser(servers[0].url, servers[0].accessToken, user.username, user.password)

    const token = await userLogin(servers[0], user)
    await getVideoWithToken(servers[0].url, token, privateVideoUUID, 403)
  })

  it('Should be able to watch this video with the correct user', async function () {
    await getVideoWithToken(servers[0].url, servers[0].accessToken, privateVideoUUID)
  })

  it('Should upload an unlisted video on server 2', async function () {
    this.timeout(30000)

    const attributes = {
      name: 'unlisted video',
      privacy: VideoPrivacy.UNLISTED
    }
    await uploadVideo(servers[1].url, servers[1].accessToken, attributes)

    // Server 2 has transcoding enabled
    await wait(10000)
  })

  it('Should not have this unlisted video listed on server 1 and 2', async function () {
    for (const server of servers) {
      const res = await getVideosList(server.url)

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.have.lengthOf(0)
    }
  })

  it('Should list my (unlisted) videos', async function () {
    const res = await getMyVideos(servers[1].url, servers[1].accessToken, 0, 1)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.have.lengthOf(1)

    unlistedVideoUUID = res.body.data[0].uuid
  })

  it('Should be able to get this unlisted video', async function () {
    for (const server of servers) {
      const res = await getVideo(server.url, unlistedVideoUUID)

      expect(res.body.name).to.equal('unlisted video')
    }
  })

  it('Should update the private video to public on server 1', async function () {
    this.timeout(10000)

    const attribute = {
      name: 'super video public',
      privacy: VideoPrivacy.PUBLIC
    }

    now = Date.now()
    await updateVideo(servers[0].url, servers[0].accessToken, privateVideoId, attribute)

    await wait(5000)
  })

  it('Should have this new public video listed on server 1 and 2', async function () {
    for (const server of servers) {
      const res = await getVideosList(server.url)

      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.have.lengthOf(1)
      expect(res.body.data[0].name).to.equal('super video public')
      expect(new Date(res.body.data[0].publishedAt).getTime()).to.be.at.least(now)
    }
  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
