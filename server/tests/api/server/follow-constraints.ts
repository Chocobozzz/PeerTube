/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  cleanupTests,
  doubleFollow,
  flushAndRunMultipleServers,
  getAccountVideos,
  getVideo,
  getVideoChannelVideos,
  getVideoWithToken,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '../../../../shared/extra-utils'
import { unfollow } from '../../../../shared/extra-utils/server/follows'
import { userLogin } from '../../../../shared/extra-utils/users/login'
import { createUser } from '../../../../shared/extra-utils/users/users'

const expect = chai.expect

describe('Test follow constraints', function () {
  let servers: ServerInfo[] = []
  let video1UUID: string
  let video2UUID: string
  let userAccessToken: string

  before(async function () {
    this.timeout(60000)

    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    {
      const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video server 1' })
      video1UUID = res.body.video.uuid
    }
    {
      const res = await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video server 2' })
      video2UUID = res.body.video.uuid
    }

    const user = {
      username: 'user1',
      password: 'super_password'
    }
    await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: user.username, password: user.password })
    userAccessToken = await userLogin(servers[0], user)

    await doubleFollow(servers[0], servers[1])
  })

  describe('With a followed instance', function () {

    describe('With an unlogged user', function () {

      it('Should get the local video', async function () {
        await getVideo(servers[0].url, video1UUID, 200)
      })

      it('Should get the remote video', async function () {
        await getVideo(servers[0].url, video2UUID, 200)
      })

      it('Should list local account videos', async function () {
        const res = await getAccountVideos(servers[0].url, undefined, 'root@localhost:' + servers[0].port, 0, 5)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)
      })

      it('Should list remote account videos', async function () {
        const res = await getAccountVideos(servers[0].url, undefined, 'root@localhost:' + servers[1].port, 0, 5)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)
      })

      it('Should list local channel videos', async function () {
        const videoChannelName = 'root_channel@localhost:' + servers[0].port
        const res = await getVideoChannelVideos(servers[0].url, undefined, videoChannelName, 0, 5)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)
      })

      it('Should list remote channel videos', async function () {
        const videoChannelName = 'root_channel@localhost:' + servers[1].port
        const res = await getVideoChannelVideos(servers[0].url, undefined, videoChannelName, 0, 5)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)
      })
    })

    describe('With a logged user', function () {
      it('Should get the local video', async function () {
        await getVideoWithToken(servers[0].url, userAccessToken, video1UUID, 200)
      })

      it('Should get the remote video', async function () {
        await getVideoWithToken(servers[0].url, userAccessToken, video2UUID, 200)
      })

      it('Should list local account videos', async function () {
        const res = await getAccountVideos(servers[0].url, userAccessToken, 'root@localhost:' + servers[0].port, 0, 5)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)
      })

      it('Should list remote account videos', async function () {
        const res = await getAccountVideos(servers[0].url, userAccessToken, 'root@localhost:' + servers[1].port, 0, 5)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)
      })

      it('Should list local channel videos', async function () {
        const videoChannelName = 'root_channel@localhost:' + servers[0].port
        const res = await getVideoChannelVideos(servers[0].url, userAccessToken, videoChannelName, 0, 5)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)
      })

      it('Should list remote channel videos', async function () {
        const videoChannelName = 'root_channel@localhost:' + servers[1].port
        const res = await getVideoChannelVideos(servers[0].url, userAccessToken, videoChannelName, 0, 5)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)
      })
    })
  })

  describe('With a non followed instance', function () {

    before(async function () {
      this.timeout(30000)

      await unfollow(servers[0].url, servers[0].accessToken, servers[1])
    })

    describe('With an unlogged user', function () {

      it('Should get the local video', async function () {
        await getVideo(servers[0].url, video1UUID, 200)
      })

      it('Should not get the remote video', async function () {
        await getVideo(servers[0].url, video2UUID, 403)
      })

      it('Should list local account videos', async function () {
        const res = await getAccountVideos(servers[0].url, undefined, 'root@localhost:' + servers[0].port, 0, 5)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)
      })

      it('Should not list remote account videos', async function () {
        const res = await getAccountVideos(servers[0].url, undefined, 'root@localhost:' + servers[1].port, 0, 5)

        expect(res.body.total).to.equal(0)
        expect(res.body.data).to.have.lengthOf(0)
      })

      it('Should list local channel videos', async function () {
        const videoChannelName = 'root_channel@localhost:' + servers[0].port
        const res = await getVideoChannelVideos(servers[0].url, undefined, videoChannelName, 0, 5)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)
      })

      it('Should not list remote channel videos', async function () {
        const videoChannelName = 'root_channel@localhost:' + servers[1].port
        const res = await getVideoChannelVideos(servers[0].url, undefined, videoChannelName, 0, 5)

        expect(res.body.total).to.equal(0)
        expect(res.body.data).to.have.lengthOf(0)
      })
    })

    describe('With a logged user', function () {
      it('Should get the local video', async function () {
        await getVideoWithToken(servers[0].url, userAccessToken, video1UUID, 200)
      })

      it('Should get the remote video', async function () {
        await getVideoWithToken(servers[0].url, userAccessToken, video2UUID, 200)
      })

      it('Should list local account videos', async function () {
        const res = await getAccountVideos(servers[0].url, userAccessToken, 'root@localhost:' + servers[0].port, 0, 5)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)
      })

      it('Should list remote account videos', async function () {
        const res = await getAccountVideos(servers[0].url, userAccessToken, 'root@localhost:' + servers[1].port, 0, 5)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)
      })

      it('Should list local channel videos', async function () {
        const videoChannelName = 'root_channel@localhost:' + servers[0].port
        const res = await getVideoChannelVideos(servers[0].url, userAccessToken, videoChannelName, 0, 5)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)
      })

      it('Should list remote channel videos', async function () {
        const videoChannelName = 'root_channel@localhost:' + servers[1].port
        const res = await getVideoChannelVideos(servers[0].url, userAccessToken, videoChannelName, 0, 5)

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.have.lengthOf(1)
      })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
