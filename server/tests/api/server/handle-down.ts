/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import { JobState, Video } from '../../../../shared/models'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { VideoCommentThreadTree } from '../../../../shared/models/videos/video-comment.model'

import {
  cleanupTests,
  closeAllSequelize,
  completeVideoCheck,
  flushAndRunMultipleServers,
  getVideo,
  getVideosList,
  immutableAssign,
  killallServers,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  setActorFollowScores,
  unfollow,
  updateVideo,
  uploadVideo,
  uploadVideoAndGetId,
  wait
} from '../../../../shared/extra-utils'
import { follow, getFollowersListPaginationAndSort } from '../../../../shared/extra-utils/server/follows'
import { getJobsListPaginationAndSort, waitJobs } from '../../../../shared/extra-utils/server/jobs'
import {
  addVideoCommentReply,
  addVideoCommentThread,
  getVideoCommentThreads,
  getVideoThreadComments
} from '../../../../shared/extra-utils/videos/video-comments'

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

  const videoIdsServer1: number[] = []

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

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(3)

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
    await follow(servers[1].url, [ servers[0].url ], servers[1].accessToken)
    await follow(servers[2].url, [ servers[0].url ], servers[2].accessToken)

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
    killallServers([ servers[1] ])

    // Remove server 2 follower
    for (let i = 0; i < 10; i++) {
      await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)
    }

    await waitJobs(servers[0])

    // Kill server 3
    killallServers([ servers[2] ])

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
      let resComment = await addVideoCommentThread(servers[0].url, servers[0].accessToken, missedVideo2.uuid, text)
      let comment = resComment.body.comment
      threadIdServer1 = comment.id

      resComment = await addVideoCommentReply(servers[0].url, servers[0].accessToken, missedVideo2.uuid, comment.id, 'comment 1-1')
      comment = resComment.body.comment

      resComment = await addVideoCommentReply(servers[0].url, servers[0].accessToken, missedVideo2.uuid, comment.id, 'comment 1-2')
      commentIdServer1 = resComment.body.comment.id
    }

    await waitJobs(servers[0])
    // Wait scheduler
    await wait(11000)

    // Only server 3 is still a follower of server 1
    const res = await getFollowersListPaginationAndSort({ url: servers[0].url, start: 0, count: 2, sort: 'createdAt' })
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)
    expect(res.body.data[0].follower.host).to.equal('localhost:' + servers[2].port)
  })

  it('Should not have pending/processing jobs anymore', async function () {
    const states: JobState[] = [ 'waiting', 'active' ]

    for (const state of states) {
      const res = await getJobsListPaginationAndSort({
        url: servers[0].url,
        accessToken: servers[0].accessToken,
        state: state,
        start: 0,
        count: 50,
        sort: '-createdAt'
      })
      expect(res.body.data).to.have.length(0)
    }
  })

  it('Should re-follow server 1', async function () {
    this.timeout(35000)

    await reRunServer(servers[1])
    await reRunServer(servers[2])

    await unfollow(servers[1].url, servers[1].accessToken, servers[0])
    await waitJobs(servers)

    await follow(servers[1].url, [ servers[0].url ], servers[1].accessToken)

    await waitJobs(servers)

    const res = await getFollowersListPaginationAndSort({ url: servers[0].url, start: 0, count: 2, sort: 'createdAt' })
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(2)
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

    await addVideoCommentReply(servers[0].url, servers[0].accessToken, missedVideo2.uuid, commentIdServer1, 'comment 1-3')

    await waitJobs(servers)

    const resVideo = await getVideo(servers[2].url, missedVideo2.uuid)
    expect(resVideo.body).not.to.be.undefined

    {
      let resComment = await getVideoCommentThreads(servers[2].url, missedVideo2.uuid, 0, 5)
      expect(resComment.body.data).to.be.an('array')
      expect(resComment.body.data).to.have.lengthOf(1)

      threadIdServer2 = resComment.body.data[0].id

      resComment = await getVideoThreadComments(servers[2].url, missedVideo2.uuid, threadIdServer2)

      const tree: VideoCommentThreadTree = resComment.body
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

    await addVideoCommentReply(servers[2].url, servers[2].accessToken, missedVideo2.uuid, commentIdServer2, 'comment 1-4')

    await waitJobs(servers)

    {
      const resComment = await getVideoThreadComments(servers[0].url, missedVideo2.uuid, threadIdServer1)

      const tree: VideoCommentThreadTree = resComment.body
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
    }
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
    await setActorFollowScores(servers[1].internalServerNumber, 20)

    // Wait video expiration
    await wait(11000)

    // Refresh video -> score + 10 = 30
    await getVideo(servers[1].url, videoIdsServer1[0])

    await waitJobs(servers)
  })

  it('Should remove followings that are down', async function () {
    this.timeout(120000)

    killallServers([ servers[0] ])

    // Wait video expiration
    await wait(11000)

    for (let i = 0; i < 3; i++) {
      await getVideo(servers[1].url, videoIdsServer1[i])
      await wait(1000)
      await waitJobs([ servers[1] ])
    }

    for (const id of videoIdsServer1) {
      await getVideo(servers[1].url, id, 403)
    }
  })

  after(async function () {
    await closeAllSequelize([ servers[1] ])

    await cleanupTests(servers)
  })
})
