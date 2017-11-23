/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { VideoPrivacy } from '../../../shared/models/videos/video-privacy.enum'
import {
  flushAndRunMultipleServers,
  flushTests,
  getVideosList,
  killallServers,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  wait
} from '../utils'
import { doubleFollow } from '../utils/follows'
import { getUserAccessToken } from '../utils/login'
import { createUser } from '../utils/users'
import { getMyVideos, getVideo, getVideoWithToken, updateVideo } from '../utils/videos'

const expect = chai.expect

describe('Test video privacy', function () {
  let servers: ServerInfo[] = []
  let privateVideoId
  let privateVideoUUID
  let unlistedVideoUUID

  before(async function () {
    this.timeout(120000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  it('Should upload a private video on server 1', async function () {
    this.timeout(15000)

    const attributes = {
      privacy: VideoPrivacy.PRIVATE
    }
    await uploadVideo(servers[0].url, servers[0].accessToken, attributes)

    await wait(11000)
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

    const token = await getUserAccessToken(servers[0], user)
    await getVideoWithToken(servers[0].url, token, privateVideoUUID, 403)
  })

  it('Should be able to watch this video with the correct user', async function () {
    await getVideoWithToken(servers[0].url, servers[0].accessToken, privateVideoUUID)
  })

  it('Should upload a unlisted video on server 2', async function () {
    this.timeout(30000)

    const attributes = {
      name: 'unlisted video',
      privacy: VideoPrivacy.UNLISTED
    }
    await uploadVideo(servers[1].url, servers[1].accessToken, attributes)

    await wait(22000)
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
    this.timeout(15000)

    const attribute = {
      name: 'super video public',
      privacy: VideoPrivacy.PUBLIC
    }

    await updateVideo(servers[0].url, servers[0].accessToken, privateVideoId, attribute)

    await wait(11000)
  })

  it('Should not have this new unlisted video listed on server 1 and 2', async function () {
    for (const server of servers) {
      const res = await getVideosList(server.url)

      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.have.lengthOf(1)
      expect(res.body.data[0].name).to.equal('super video public')
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
