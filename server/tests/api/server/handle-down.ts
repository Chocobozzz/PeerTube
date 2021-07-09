/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { HttpStatusCode } from '@shared/core-utils'
import {
  cleanupTests,
  CommentsCommand,
  completeVideoCheck,
  flushAndRunMultipleServers,
  getVideo,
  getVideosList,
  immutableAssign,
  killallServers,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  updateVideo,
  uploadVideo,
  uploadVideoAndGetId,
  wait,
  waitJobs
} from '@shared/extra-utils'
import { JobState, Video, VideoPrivacy } from '@shared/models'

const expect = chai.expect

describe('Test handle downs', function () {
  let servers: ServerInfo[] = []
  let threadIdServer1: number
  let threadIdServer2: number
  let commentIdServer1: number
  let commentIdServer2: number
  let missedVideo1: Video
  let missedVideo2: Video
  let unlistedVideo: Video

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

  const unlistedVideoAttributes = immutableAssign(videoAttributes, {
    privacy: VideoPrivacy.UNLISTED
  })

  let checkAttributes: any
  let unlistedCheckAttributes: any

  let commentCommands: CommentsCommand[]

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(3)
    commentCommands = servers.map(s => s.commentsCommand)

    checkAttributes = {
      name: 'my super name for server 1',
      category: 5,
      licence: 4,
      language: 'ja',
      nsfw: true,
      description: 'my super description for server 1',
      support: 'my super support text for server 1',
      account: {
        name: 'root',
        host: 'localhost:' + servers[0].port
      },
      isLocal: false,
      duration: 10,
      tags: [ 'tag1p1', 'tag2p1' ],
      privacy: VideoPrivacy.PUBLIC,
      commentsEnabled: true,
      downloadEnabled: true,
      channel: {
        name: 'root_channel',
        displayName: 'Main root channel',
        description: '',
        isLocal: false
      },
      fixture: 'video_short1.webm',
      files: [
        {
          resolution: 720,
          size: 572456
        }
      ]
    }
    unlistedCheckAttributes = immutableAssign(checkAttributes, {
      privacy: VideoPrivacy.UNLISTED
    })

    // Get the access tokens
    await setAccessTokensToServers(servers)
  })

  it('Should remove followers that are often down', async function () {
    this.timeout(240000)

    // Server 2 and 3 follow server 1
    await servers[1].followsCommand.follow({ targets: [ servers[0].url ] })
    await servers[2].followsCommand.follow({ targets: [ servers[0].url ] })

    await waitJobs(servers)

    // Upload a video to server 1
    await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)

    await waitJobs(servers)

    // And check all servers have this video
    for (const server of servers) {
      const res = await getVideosList(server.url)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(1)
    }

    // Kill server 2
    await killallServers([ servers[1] ])

    // Remove server 2 follower
    for (let i = 0; i < 10; i++) {
      await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)
    }

    await waitJobs([ servers[0], servers[2] ])

    // Kill server 3
    await killallServers([ servers[2] ])

    const resLastVideo1 = await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)
    missedVideo1 = resLastVideo1.body.video

    const resLastVideo2 = await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)
    missedVideo2 = resLastVideo2.body.video

    // Unlisted video
    const resVideo = await uploadVideo(servers[0].url, servers[0].accessToken, unlistedVideoAttributes)
    unlistedVideo = resVideo.body.video

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
    const body = await servers[0].followsCommand.getFollowers({ start: 0, count: 2, sort: 'createdAt' })
    expect(body.data).to.be.an('array')
    expect(body.data).to.have.lengthOf(1)
    expect(body.data[0].follower.host).to.equal('localhost:' + servers[2].port)
  })

  it('Should not have pending/processing jobs anymore', async function () {
    const states: JobState[] = [ 'waiting', 'active' ]

    for (const state of states) {
      const body = await servers[0].jobsCommand.getJobsList({
        state: state,
        start: 0,
        count: 50,
        sort: '-createdAt'
      })
      expect(body.data).to.have.length(0)
    }
  })

  it('Should re-follow server 1', async function () {
    this.timeout(35000)

    await reRunServer(servers[1])
    await reRunServer(servers[2])

    await servers[1].followsCommand.unfollow({ target: servers[0] })
    await waitJobs(servers)

    await servers[1].followsCommand.follow({ targets: [ servers[0].url ] })

    await waitJobs(servers)

    const body = await servers[0].followsCommand.getFollowers({ start: 0, count: 2, sort: 'createdAt' })
    expect(body.data).to.be.an('array')
    expect(body.data).to.have.lengthOf(2)
  })

  it('Should send an update to server 3, and automatically fetch the video', async function () {
    this.timeout(15000)

    const res1 = await getVideosList(servers[2].url)
    expect(res1.body.data).to.be.an('array')
    expect(res1.body.data).to.have.lengthOf(11)

    await updateVideo(servers[0].url, servers[0].accessToken, missedVideo1.uuid, {})
    await updateVideo(servers[0].url, servers[0].accessToken, unlistedVideo.uuid, {})

    await waitJobs(servers)

    const res = await getVideosList(servers[2].url)
    expect(res.body.data).to.be.an('array')
    // 1 video is unlisted
    expect(res.body.data).to.have.lengthOf(12)

    // Check unlisted video
    const resVideo = await getVideo(servers[2].url, unlistedVideo.uuid)
    expect(resVideo.body).not.to.be.undefined

    await completeVideoCheck(servers[2].url, resVideo.body, unlistedCheckAttributes)
  })

  it('Should send comments on a video to server 3, and automatically fetch the video', async function () {
    this.timeout(25000)

    await commentCommands[0].addReply({ videoId: missedVideo2.uuid, toCommentId: commentIdServer1, text: 'comment 1-3' })

    await waitJobs(servers)

    const resVideo = await getVideo(servers[2].url, missedVideo2.uuid)
    expect(resVideo.body).not.to.be.undefined

    {
      const { data } = await servers[2].commentsCommand.listThreads({ videoId: missedVideo2.uuid })
      expect(data).to.be.an('array')
      expect(data).to.have.lengthOf(1)

      threadIdServer2 = data[0].id

      const tree = await servers[2].commentsCommand.getThread({ videoId: missedVideo2.uuid, threadId: threadIdServer2 })
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
    this.timeout(15000)

    await servers[2].commentsCommand.addReply({ videoId: missedVideo2.uuid, toCommentId: commentIdServer2, text: 'comment 1-4' })

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
    this.timeout(120000)

    for (let i = 0; i < 10; i++) {
      const uuid = (await uploadVideoAndGetId({ server: servers[0], videoName: 'video ' + i })).uuid
      videoIdsServer1.push(uuid)
    }

    await waitJobs(servers)

    for (const id of videoIdsServer1) {
      await getVideo(servers[1].url, id)
    }

    await waitJobs(servers)
    await servers[1].sqlCommand.setActorFollowScores(20)

    // Wait video expiration
    await wait(11000)

    // Refresh video -> score + 10 = 30
    await getVideo(servers[1].url, videoIdsServer1[0])

    await waitJobs(servers)
  })

  it('Should remove followings that are down', async function () {
    this.timeout(120000)

    await killallServers([ servers[0] ])

    // Wait video expiration
    await wait(11000)

    for (let i = 0; i < 5; i++) {
      try {
        await getVideo(servers[1].url, videoIdsServer1[i])
        await waitJobs([ servers[1] ])
        await wait(1500)
      } catch {}
    }

    for (const id of videoIdsServer1) {
      await getVideo(servers[1].url, id, HttpStatusCode.FORBIDDEN_403)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
