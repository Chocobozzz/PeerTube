/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  followAll,
  makeActivityPubGetRequest,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test ActivityPub audience', function () {
  let servers: PeerTubeServer[] = []
  const publicUrl = 'https://www.w3.org/ns/activitystreams#Public'
  let videoUUID: string

  let userToken: string

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    await followAll(servers)

    userToken = await servers[0].users.generateUserAndToken('user')
  })

  it('Should have the correct audience for a video', async function () {
    const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
    videoUUID = uuid

    const { body } = await makeActivityPubGetRequest(servers[0].url, '/w/' + uuid)

    expect(body.to).to.have.members([ publicUrl, servers[0].url + '/video-channels/root_channel' ])
    expect(body.cc).to.have.members([ servers[0].url + '/accounts/root/followers' ])
  })

  it('Should have a correct audience for a thread', async function () {
    const { id } = await servers[0].comments.createThread({ videoId: videoUUID, text: 'thread', token: userToken })

    const { body } = await makeActivityPubGetRequest(servers[0].url, '/videos/watch/' + videoUUID + '/comments/' + id)

    expect(body.to).to.have.members([ publicUrl ])
    expect(body.cc).to.have.members([
      servers[0].url + '/video-channels/root_channel',
      servers[0].url + '/accounts/user/followers',
      servers[0].url + '/accounts/root'
    ])
  })

  it('Should have the correct audience for a reply', async function () {
    await waitJobs(servers)

    const threadId = await servers[1].comments.findCommentId({ text: 'thread', videoId: videoUUID })

    const { id } = await servers[1].comments.addReply({ videoId: videoUUID, toCommentId: threadId, text: 'reply' })
    const { body } = await makeActivityPubGetRequest(servers[1].url, '/videos/watch/' + videoUUID + '/comments/' + id)

    expect(body.to).to.have.members([ publicUrl ])
    expect(body.cc).to.have.members([
      servers[0].url + '/video-channels/root_channel',
      servers[0].url + '/accounts/user',
      servers[0].url + '/accounts/root',
      servers[1].url + '/accounts/root/followers'
    ])
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
