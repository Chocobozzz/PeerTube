/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  doubleFollow,
  flushAndRunMultipleServers,
  flushTests,
  killallServers,
  makeActivityPubGetRequest,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '../../../../shared/extra-utils'

const expect = chai.expect

describe('Test activitypub', function () {
  let servers: ServerInfo[] = []
  let videoUUID: string

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)

    {
      const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video' })
      videoUUID = res.body.video.uuid
    }

    await doubleFollow(servers[0], servers[1])
  })

  it('Should return the account object', async function () {
    const res = await makeActivityPubGetRequest(servers[0].url, '/accounts/root')
    const object = res.body

    expect(object.type).to.equal('Person')
    expect(object.id).to.equal('http://localhost:9001/accounts/root')
    expect(object.name).to.equal('root')
    expect(object.preferredUsername).to.equal('root')
  })

  it('Should return the video object', async function () {
    const res = await makeActivityPubGetRequest(servers[0].url, '/videos/watch/' + videoUUID)
    const object = res.body

    expect(object.type).to.equal('Video')
    expect(object.id).to.equal('http://localhost:9001/videos/watch/' + videoUUID)
    expect(object.name).to.equal('video')
  })

  it('Should redirect to the origin video object', async function () {
    const res = await makeActivityPubGetRequest(servers[1].url, '/videos/watch/' + videoUUID, 302)

    expect(res.header.location).to.equal('http://localhost:9001/videos/watch/' + videoUUID)
  })

  after(function () {
    killallServers(servers)
  })
})
