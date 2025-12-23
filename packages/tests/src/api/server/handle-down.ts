/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, JobState, VideoCommentPolicy, VideoCreateResult, VideoPrivacy } from '@peertube/peertube-models'
import {
  CommentsCommand,
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  killallServers,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { completeVideoCheck } from '@tests/shared/videos.js'
import { expect } from 'chai'

describe('Test handle downs', function () {
  let servers: PeerTubeServer[] = []
  let sqlCommands: SQLCommand[] = []

  let threadIdServer1: number
  let threadIdServer2: number
  let commentIdServer1: number
  let commentIdServer2: number
  let missedVideo1: VideoCreateResult
  let missedVideo2: VideoCreateResult
  let unlistedVideo: VideoCreateResult

  const videoIdsServer1: string[] = []

  const videoAttributes = {
    name: 'my super name for server 1',
    category: 5,
    licence: 4,
    language: 'ja',
    nsfw: true,
    privacy: VideoPrivacy.PUBLIC,
    description: 'my super description for server 1',
    support: 'my super support text for server 1',
    tags: [ 'tag1p1', 'tag2p1' ],
    fixture: 'video_short1.webm'
  }

  const unlistedVideoAttributes = { ...videoAttributes, privacy: VideoPrivacy.UNLISTED }

  const checkAttributes = {
    name: 'my super name for server 1',
    category: 5,
    licence: 4,
    language: 'ja',
    nsfw: true,
    description: 'my super description for server 1',
    support: 'my super support text for server 1',
    account: {
      name: 'root',
      host: ''
    },
    duration: 10,
    tags: [ 'tag1p1', 'tag2p1' ],
    privacy: VideoPrivacy.PUBLIC,
    commentsPolicy: VideoCommentPolicy.ENABLED,
    downloadEnabled: true,
    channel: {
      name: 'root_channel',
      displayName: 'Main root channel',
      description: ''
    },
    fixture: 'video_short1.webm',
    files: [
      {
        height: 720,
        width: 1280,
        resolution: 720,
        size: 572456
      }
    ]
  }
  const unlistedCheckAttributes = { ...checkAttributes, privacy: VideoPrivacy.UNLISTED }

  let commentCommands: CommentsCommand[]

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(3)
    commentCommands = servers.map(s => s.comments)

    checkAttributes.account.host = servers[0].host
    unlistedCheckAttributes.account.host = servers[0].host

    // Get the access tokens
    await setAccessTokensToServers(servers)

    sqlCommands = servers.map(s => new SQLCommand(s))
  })

  it('Should remove followers that are often down', async function () {
    this.timeout(240000)

    // Server 2 and 3 follow server 1
    await servers[1].follows.follow({ hosts: [ servers[0].url ] })
    await servers[2].follows.follow({ hosts: [ servers[0].url ] })

    await waitJobs(servers)

    // Upload a video to server 1
    await servers[0].videos.upload({ attributes: videoAttributes })

    await waitJobs(servers)

    // And check all servers have this video
    for (const server of servers) {
      const { data } = await server.videos.list()
      expect(data).to.be.an('array')
      expect(data).to.have.lengthOf(1)
    }

    // Kill server 2
    await killallServers([ servers[1] ])

    // Remove server 2 follower
    for (let i = 0; i < 10; i++) {
      await servers[0].videos.upload({ attributes: videoAttributes })
    }

    await waitJobs([ servers[0], servers[2] ])

    // Kill server 3
    await killallServers([ servers[2] ])

    missedVideo1 = await servers[0].videos.upload({ attributes: videoAttributes })

    missedVideo2 = await servers[0].videos.upload({ attributes: videoAttributes })

    // Unlisted video
    unlistedVideo = await servers[0].videos.upload({ attributes: unlistedVideoAttributes })

    // Add comments to video 2
    {
      const text = 'thread 1'
      let comment = await commentCommands[0].createThread({ videoId: missedVideo2.uuid, text })
      threadIdServer1 = comment.id

      comment = await commentCommands[0].addReply({ videoId: missedVideo2.uuid, toCommentId: comment.id, text: 'comment 1-1' })

      const created = await commentCommands[0].addReply({ videoId: missedVideo2.uuid, toCommentId: comment.id, text: 'comment 1-2' })
      commentIdServer1 = created.id
    }

    await waitJobs(servers[0])
    // Wait scheduler
    await wait(11000)

    // Only server 3 is still a follower of server 1
    const body = await servers[0].follows.getFollowers({ start: 0, count: 2, sort: 'createdAt' })
    expect(body.data).to.be.an('array')
    expect(body.data).to.have.lengthOf(1)
    expect(body.data[0].follower.host).to.equal(servers[2].host)
  })

  it('Should not have pending/processing jobs anymore', async function () {
    const states: JobState[] = [ 'waiting', 'active' ]

    for (const state of states) {
      const body = await servers[0].jobs.list({
        state,
        start: 0,
        count: 50,
        sort: '-createdAt'
      })
      expect(body.data).to.have.length(0)
    }
  })

  it('Should re-follow server 1', async function () {
    this.timeout(70000)

    await servers[1].run()
    await servers[2].run()

    await servers[1].follows.unfollow({ target: servers[0] })
    await waitJobs(servers)

    await servers[1].follows.follow({ hosts: [ servers[0].url ] })

    await waitJobs(servers)

    const body = await servers[0].follows.getFollowers({ start: 0, count: 2, sort: 'createdAt' })
    expect(body.data).to.be.an('array')
    expect(body.data).to.have.lengthOf(2)
  })

  it('Should send an update to server 3, and automatically fetch the video', async function () {
    this.timeout(15000)

    {
      const { data } = await servers[2].videos.list()
      expect(data).to.be.an('array')
      expect(data).to.have.lengthOf(11)
    }

    await servers[0].videos.update({ id: missedVideo1.uuid })
    await servers[0].videos.update({ id: unlistedVideo.uuid })

    await waitJobs(servers)

    {
      const { data } = await servers[2].videos.list()
      expect(data).to.be.an('array')
      // 1 video is unlisted
      expect(data).to.have.lengthOf(12)
    }

    // Check unlisted video
    const video = await servers[2].videos.get({ id: unlistedVideo.uuid })
    await completeVideoCheck({ server: servers[2], originServer: servers[0], videoUUID: video.uuid, attributes: unlistedCheckAttributes })
  })

  it('Should send comments on a video to server 3, and automatically fetch the video', async function () {
    this.timeout(25000)

    await commentCommands[0].addReply({ videoId: missedVideo2.uuid, toCommentId: commentIdServer1, text: 'comment 1-3' })

    await waitJobs(servers)

    await servers[2].videos.get({ id: missedVideo2.uuid })

    {
      const { data } = await servers[2].comments.listThreads({ videoId: missedVideo2.uuid })
      expect(data).to.be.an('array')
      expect(data).to.have.lengthOf(1)

      threadIdServer2 = data[0].id

      const tree = await servers[2].comments.getThread({ videoId: missedVideo2.uuid, threadId: threadIdServer2 })
      expect(tree.comment.text).equal('thread 1')
      expect(tree.children).to.have.lengthOf(1)

      const firstChild = tree.children[0]
      expect(firstChild.comment.text).to.equal('comment 1-1')
      expect(firstChild.children).to.have.lengthOf(1)

      const childOfFirstChild = firstChild.children[0]
      expect(childOfFirstChild.comment.text).to.equal('comment 1-2')
      expect(childOfFirstChild.children).to.have.lengthOf(1)

      const childOfChildFirstChild = childOfFirstChild.children[0]
      expect(childOfChildFirstChild.comment.text).to.equal('comment 1-3')
      expect(childOfChildFirstChild.children).to.have.lengthOf(0)

      commentIdServer2 = childOfChildFirstChild.comment.id
    }
  })

  it('Should correctly reply to the comment', async function () {
    await servers[2].comments.addReply({ videoId: missedVideo2.uuid, toCommentId: commentIdServer2, text: 'comment 1-4' })

    await waitJobs(servers)

    const tree = await commentCommands[0].getThread({ videoId: missedVideo2.uuid, threadId: threadIdServer1 })

    expect(tree.comment.text).equal('thread 1')
    expect(tree.children).to.have.lengthOf(1)

    const firstChild = tree.children[0]
    expect(firstChild.comment.text).to.equal('comment 1-1')
    expect(firstChild.children).to.have.lengthOf(1)

    const childOfFirstChild = firstChild.children[0]
    expect(childOfFirstChild.comment.text).to.equal('comment 1-2')
    expect(childOfFirstChild.children).to.have.lengthOf(1)

    const childOfChildFirstChild = childOfFirstChild.children[0]
    expect(childOfChildFirstChild.comment.text).to.equal('comment 1-3')
    expect(childOfChildFirstChild.children).to.have.lengthOf(1)

    const childOfChildOfChildOfFirstChild = childOfChildFirstChild.children[0]
    expect(childOfChildOfChildOfFirstChild.comment.text).to.equal('comment 1-4')
    expect(childOfChildOfChildOfFirstChild.children).to.have.lengthOf(0)
  })

  it('Should upload many videos on server 1', async function () {
    this.timeout(240000)

    for (let i = 0; i < 10; i++) {
      const uuid = (await servers[0].videos.quickUpload({ name: 'video ' + i })).uuid
      videoIdsServer1.push(uuid)
    }

    await waitJobs(servers)

    for (const id of videoIdsServer1) {
      await servers[1].videos.get({ id })
    }

    await waitJobs(servers)
    await sqlCommands[1].setActorFollowScores(20)

    // Wait video expiration
    await wait(11000)

    // Refresh video -> score + 10 = 30
    await servers[1].videos.get({ id: videoIdsServer1[0] })

    await waitJobs(servers)
  })

  it('Should remove followings that are down', async function () {
    this.timeout(120000)

    await killallServers([ servers[0] ])

    // Wait video expiration
    await wait(11000)

    for (let i = 0; i < 5; i++) {
      try {
        await servers[1].videos.get({ id: videoIdsServer1[i] })
        await waitJobs([ servers[1] ])
        await wait(1500)
      } catch {}
    }

    for (const id of videoIdsServer1) {
      await servers[1].videos.get({ id, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    }
  })

  after(async function () {
    for (const sqlCommand of sqlCommands) {
      await sqlCommand.cleanup()
    }

    await cleanupTests(servers)
  })
})
