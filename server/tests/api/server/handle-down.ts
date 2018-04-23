/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { JobState } from '../../../../shared/models'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { VideoCommentThreadTree } from '../../../../shared/models/videos/video-comment.model'
import { completeVideoCheck, getVideo, immutableAssign, reRunServer, viewVideo } from '../../utils'

import {
  flushAndRunMultipleServers, flushTests, getVideosList, killallServers, ServerInfo, setAccessTokensToServers, uploadVideo,
  wait
} from '../../utils/index'
import { follow, getFollowersListPaginationAndSort } from '../../utils/server/follows'
import { getJobsListPaginationAndSort } from '../../utils/server/jobs'
import {
  addVideoCommentReply, addVideoCommentThread, getVideoCommentThreads,
  getVideoThreadComments
} from '../../utils/videos/video-comments'

const expect = chai.expect

describe('Test handle downs', function () {
  let servers: ServerInfo[] = []
  const videos = []
  let threadIdServer1: number
  let threadIdServer2: number
  let commentIdServer1: number
  let commentIdServer2: number

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
      host: 'localhost:9001'
    },
    isLocal: false,
    duration: 10,
    tags: [ 'tag1p1', 'tag2p1' ],
    privacy: VideoPrivacy.PUBLIC,
    commentsEnabled: true,
    channel: {
      name: 'Default root channel',
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

  const unlistedCheckAttributes = immutableAssign(checkAttributes, {
    privacy: VideoPrivacy.UNLISTED
  })

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
  })

  it('Should remove followers that are often down', async function () {
    this.timeout(60000)

    await follow(servers[1].url, [ servers[0].url ], servers[1].accessToken)

    await wait(5000)

    await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)

    await wait(5000)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data).to.have.lengthOf(1)
    }

    // Kill server 1
    killallServers([ servers[1] ])

    let resVideo = await uploadVideo(servers[ 0 ].url, servers[ 0 ].accessToken, unlistedVideoAttributes)
    videos.push(resVideo.body.video)

    // Remove server 2 follower
    for (let i = 0; i < 10; i++) {
      resVideo = await uploadVideo(servers[ 0 ].url, servers[ 0 ].accessToken, videoAttributes)
      videos.push(resVideo.body.video)
    }

    await wait(2000)

    await uploadVideo(servers[ 0 ].url, servers[ 0 ].accessToken, videoAttributes)

    // Add comments to video 2
    {
      const text = 'thread 1'
      let resComment = await addVideoCommentThread(servers[0].url, servers[0].accessToken, videos[1].uuid, text)
      let comment = resComment.body.comment
      threadIdServer1 = comment.id

      resComment = await addVideoCommentReply(servers[0].url, servers[0].accessToken, videos[1].uuid, comment.id, 'comment 1-1')
      comment = resComment.body.comment

      resComment = await addVideoCommentReply(servers[0].url, servers[0].accessToken, videos[1].uuid, comment.id, 'comment 1-2')
      commentIdServer1 = resComment.body.comment.id
    }

    await wait(10000)

    const res = await getFollowersListPaginationAndSort(servers[0].url, 0, 1, 'createdAt')
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(0)
  })

  it('Should not have pending/processing jobs anymore', async function () {
    const states: JobState[] = [ 'inactive', 'active' ]

    for (const state of states) {
      const res = await getJobsListPaginationAndSort(servers[ 0 ].url, servers[ 0 ].accessToken, state,0, 50, '-createdAt')
      expect(res.body.data).to.have.length(0)
    }
  })

  it('Should follow server 1', async function () {
    this.timeout(15000)

    await reRunServer(servers[1])

    await follow(servers[1].url, [ servers[0].url ], servers[1].accessToken)

    await wait(5000)

    const res = await getFollowersListPaginationAndSort(servers[0].url, 0, 1, 'createdAt')
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)
  })

  it('Should send a view to server 2, and automatically fetch the video', async function () {
    this.timeout(15000)

    await viewVideo(servers[0].url, videos[0].uuid)

    await wait(5000)

    const res = await getVideosList(servers[1].url)
    expect(res.body.data).to.be.an('array')
    // Video is unlisted
    expect(res.body.data).to.have.lengthOf(1)

    const resVideo = await getVideo(servers[1].url, videos[0].uuid)
    expect(resVideo.body).not.to.be.undefined

    await completeVideoCheck(servers[1].url, resVideo.body, unlistedCheckAttributes)
  })

  it('Should send comments on a video to server 2, and automatically fetch the video', async function () {
    this.timeout(25000)

    await addVideoCommentReply(servers[0].url, servers[0].accessToken, videos[1].uuid, commentIdServer1, 'comment 1-3')

    await wait(5000)

    const resVideo = await getVideo(servers[1].url, videos[0].uuid)
    expect(resVideo.body).not.to.be.undefined

    await completeVideoCheck(servers[1].url, resVideo.body, unlistedCheckAttributes)

    {
      let resComment = await getVideoCommentThreads(servers[1].url, videos[1].uuid, 0, 5)
      expect(resComment.body.data).to.be.an('array')
      expect(resComment.body.data).to.have.lengthOf(1)

      threadIdServer2 = resComment.body.data[0].id

      resComment = await getVideoThreadComments(servers[1].url, videos[1].uuid, threadIdServer2)

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

    await addVideoCommentReply(servers[1].url, servers[1].accessToken, videos[1].uuid, commentIdServer2, 'comment 1-4')

    await wait(5000)

    {
      const resComment = await getVideoThreadComments(servers[0].url, videos[1].uuid, threadIdServer1)

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

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
