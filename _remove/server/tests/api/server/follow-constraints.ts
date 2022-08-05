/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { cleanupTests, createMultipleServers, doubleFollow, PeerTubeServer, setAccessTokensToServers } from '@shared/server-commands'
import { HttpStatusCode, PeerTubeProblemDocument, ServerErrorCode } from '@shared/models'

const expect = chai.expect

describe('Test follow constraints', function () {
  let servers: PeerTubeServer[] = []
  let video1UUID: string
  let video2UUID: string
  let userToken: string

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    {
      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video server 1' } })
      video1UUID = uuid
    }
    {
      const { uuid } = await servers[1].videos.upload({ attributes: { name: 'video server 2' } })
      video2UUID = uuid
    }

    const user = {
      username: 'user1',
      password: 'super_password'
    }
    await servers[0].users.create({ username: user.username, password: user.password })
    userToken = await servers[0].login.getAccessToken(user)

    await doubleFollow(servers[0], servers[1])
  })

  describe('With a followed instance', function () {

    describe('With an unlogged user', function () {

      it('Should get the local video', async function () {
        await servers[0].videos.get({ id: video1UUID })
      })

      it('Should get the remote video', async function () {
        await servers[0].videos.get({ id: video2UUID })
      })

      it('Should list local account videos', async function () {
        const { total, data } = await servers[0].videos.listByAccount({ handle: 'root@localhost:' + servers[0].port })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      })

      it('Should list remote account videos', async function () {
        const { total, data } = await servers[0].videos.listByAccount({ handle: 'root@localhost:' + servers[1].port })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      })

      it('Should list local channel videos', async function () {
        const handle = 'root_channel@localhost:' + servers[0].port
        const { total, data } = await servers[0].videos.listByChannel({ handle })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      })

      it('Should list remote channel videos', async function () {
        const handle = 'root_channel@localhost:' + servers[1].port
        const { total, data } = await servers[0].videos.listByChannel({ handle })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      })
    })

    describe('With a logged user', function () {
      it('Should get the local video', async function () {
        await servers[0].videos.getWithToken({ token: userToken, id: video1UUID })
      })

      it('Should get the remote video', async function () {
        await servers[0].videos.getWithToken({ token: userToken, id: video2UUID })
      })

      it('Should list local account videos', async function () {
        const { total, data } = await servers[0].videos.listByAccount({ token: userToken, handle: 'root@localhost:' + servers[0].port })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      })

      it('Should list remote account videos', async function () {
        const { total, data } = await servers[0].videos.listByAccount({ token: userToken, handle: 'root@localhost:' + servers[1].port })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      })

      it('Should list local channel videos', async function () {
        const handle = 'root_channel@localhost:' + servers[0].port
        const { total, data } = await servers[0].videos.listByChannel({ token: userToken, handle })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      })

      it('Should list remote channel videos', async function () {
        const handle = 'root_channel@localhost:' + servers[1].port
        const { total, data } = await servers[0].videos.listByChannel({ token: userToken, handle })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      })
    })
  })

  describe('With a non followed instance', function () {

    before(async function () {
      this.timeout(30000)

      await servers[0].follows.unfollow({ target: servers[1] })
    })

    describe('With an unlogged user', function () {

      it('Should get the local video', async function () {
        await servers[0].videos.get({ id: video1UUID })
      })

      it('Should not get the remote video', async function () {
        const body = await servers[0].videos.get({ id: video2UUID, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        const error = body as unknown as PeerTubeProblemDocument

        const doc = 'https://docs.joinpeertube.org/api-rest-reference.html#section/Errors/does_not_respect_follow_constraints'
        expect(error.type).to.equal(doc)
        expect(error.code).to.equal(ServerErrorCode.DOES_NOT_RESPECT_FOLLOW_CONSTRAINTS)

        expect(error.detail).to.equal('Cannot get this video regarding follow constraints')
        expect(error.error).to.equal(error.detail)

        expect(error.status).to.equal(HttpStatusCode.FORBIDDEN_403)

        expect(error.originUrl).to.contains(servers[1].url)
      })

      it('Should list local account videos', async function () {
        const { total, data } = await servers[0].videos.listByAccount({
          token: null,
          handle: 'root@localhost:' + servers[0].port
        })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      })

      it('Should not list remote account videos', async function () {
        const { total, data } = await servers[0].videos.listByAccount({
          token: null,
          handle: 'root@localhost:' + servers[1].port
        })

        expect(total).to.equal(0)
        expect(data).to.have.lengthOf(0)
      })

      it('Should list local channel videos', async function () {
        const handle = 'root_channel@localhost:' + servers[0].port
        const { total, data } = await servers[0].videos.listByChannel({ token: null, handle })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      })

      it('Should not list remote channel videos', async function () {
        const handle = 'root_channel@localhost:' + servers[1].port
        const { total, data } = await servers[0].videos.listByChannel({ token: null, handle })

        expect(total).to.equal(0)
        expect(data).to.have.lengthOf(0)
      })
    })

    describe('With a logged user', function () {
      it('Should get the local video', async function () {
        await servers[0].videos.getWithToken({ token: userToken, id: video1UUID })
      })

      it('Should get the remote video', async function () {
        await servers[0].videos.getWithToken({ token: userToken, id: video2UUID })
      })

      it('Should list local account videos', async function () {
        const { total, data } = await servers[0].videos.listByAccount({ token: userToken, handle: 'root@localhost:' + servers[0].port })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      })

      it('Should list remote account videos', async function () {
        const { total, data } = await servers[0].videos.listByAccount({ token: userToken, handle: 'root@localhost:' + servers[1].port })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      })

      it('Should list local channel videos', async function () {
        const handle = 'root_channel@localhost:' + servers[0].port
        const { total, data } = await servers[0].videos.listByChannel({ token: userToken, handle })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      })

      it('Should list remote channel videos', async function () {
        const handle = 'root_channel@localhost:' + servers[1].port
        const { total, data } = await servers[0].videos.listByChannel({ token: userToken, handle })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
