/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { Video, VideoPrivacy } from '../../../../shared/models/videos'
import { VideoComment, VideoCommentThreadTree } from '../../../../shared/models/videos/video-comment.model'
import { completeVideoCheck } from '../../utils'
import {
  flushAndRunMultipleServers,
  getVideosList,
  killallServers,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '../../utils/index'
import { dateIsValid } from '../../utils/miscs/miscs'
import { follow, getFollowersListPaginationAndSort, getFollowingListPaginationAndSort, unfollow } from '../../utils/server/follows'
import { expectAccountFollows } from '../../utils/users/accounts'
import { userLogin } from '../../utils/users/login'
import { createUser } from '../../utils/users/users'
import {
  addVideoCommentReply,
  addVideoCommentThread,
  getVideoCommentThreads,
  getVideoThreadComments
} from '../../utils/videos/video-comments'
import { rateVideo } from '../../utils/videos/videos'
import { waitJobs } from '../../utils/server/jobs'
import { createVideoCaption, listVideoCaptions, testCaptionFile } from '../../utils/videos/video-captions'
import { VideoCaption } from '../../../../shared/models/videos/caption/video-caption.model'

const expect = chai.expect

describe('Test follows', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)
  })

  it('Should not have followers', async function () {
    for (const server of servers) {
      const res = await getFollowersListPaginationAndSort(server.url, 0, 5, 'createdAt')
      const follows = res.body.data

      expect(res.body.total).to.equal(0)
      expect(follows).to.be.an('array')
      expect(follows.length).to.equal(0)
    }
  })

  it('Should not have following', async function () {
    for (const server of servers) {
      const res = await getFollowingListPaginationAndSort(server.url, 0, 5, 'createdAt')
      const follows = res.body.data

      expect(res.body.total).to.equal(0)
      expect(follows).to.be.an('array')
      expect(follows.length).to.equal(0)
    }
  })

  it('Should have server 1 following server 2 and 3', async function () {
    this.timeout(30000)

    await follow(servers[0].url, [ servers[1].url, servers[2].url ], servers[0].accessToken)

    await waitJobs(servers)
  })

  it('Should have 2 followings on server 1', async function () {
    let res = await getFollowingListPaginationAndSort(servers[0].url, 0, 1, 'createdAt')
    let follows = res.body.data

    expect(res.body.total).to.equal(2)
    expect(follows).to.be.an('array')
    expect(follows.length).to.equal(1)

    res = await getFollowingListPaginationAndSort(servers[0].url, 1, 1, 'createdAt')
    follows = follows.concat(res.body.data)

    const server2Follow = follows.find(f => f.following.host === 'localhost:9002')
    const server3Follow = follows.find(f => f.following.host === 'localhost:9003')

    expect(server2Follow).to.not.be.undefined
    expect(server3Follow).to.not.be.undefined
    expect(server2Follow.state).to.equal('accepted')
    expect(server3Follow.state).to.equal('accepted')
  })

  it('Should have 0 followings on server 1 and 2', async function () {
    for (const server of [ servers[1], servers[2] ]) {
      const res = await getFollowingListPaginationAndSort(server.url, 0, 5, 'createdAt')
      const follows = res.body.data

      expect(res.body.total).to.equal(0)
      expect(follows).to.be.an('array')
      expect(follows.length).to.equal(0)
    }
  })

  it('Should have 1 followers on server 2 and 3', async function () {
    for (const server of [ servers[1], servers[2] ]) {
      let res = await getFollowersListPaginationAndSort(server.url, 0, 1, 'createdAt')

      let follows = res.body.data
      expect(res.body.total).to.equal(1)
      expect(follows).to.be.an('array')
      expect(follows.length).to.equal(1)
      expect(follows[0].follower.host).to.equal('localhost:9001')
    }
  })

  it('Should have 0 followers on server 1', async function () {
    const res = await getFollowersListPaginationAndSort(servers[0].url, 0, 5, 'createdAt')
    const follows = res.body.data

    expect(res.body.total).to.equal(0)
    expect(follows).to.be.an('array')
    expect(follows.length).to.equal(0)
  })

  it('Should have the correct follows counts', async function () {
    await expectAccountFollows(servers[0].url, 'peertube@localhost:9001', 0, 2)
    await expectAccountFollows(servers[0].url, 'peertube@localhost:9002', 1, 0)
    await expectAccountFollows(servers[0].url, 'peertube@localhost:9003', 1, 0)

    // Server 2 and 3 does not know server 1 follow another server (there was not a refresh)
    await expectAccountFollows(servers[1].url, 'peertube@localhost:9001', 0, 1)
    await expectAccountFollows(servers[1].url, 'peertube@localhost:9002', 1, 0)

    await expectAccountFollows(servers[2].url, 'peertube@localhost:9001', 0, 1)
    await expectAccountFollows(servers[2].url, 'peertube@localhost:9003', 1, 0)
  })

  it('Should unfollow server 3 on server 1', async function () {
    this.timeout(5000)

    await unfollow(servers[0].url, servers[0].accessToken, servers[2])

    await waitJobs(servers)
  })

  it('Should not follow server 3 on server 1 anymore', async function () {
    const res = await getFollowingListPaginationAndSort(servers[0].url, 0, 2, 'createdAt')
    let follows = res.body.data

    expect(res.body.total).to.equal(1)
    expect(follows).to.be.an('array')
    expect(follows.length).to.equal(1)

    expect(follows[0].following.host).to.equal('localhost:9002')
  })

  it('Should not have server 1 as follower on server 3 anymore', async function () {
    const res = await getFollowersListPaginationAndSort(servers[2].url, 0, 1, 'createdAt')

    let follows = res.body.data
    expect(res.body.total).to.equal(0)
    expect(follows).to.be.an('array')
    expect(follows.length).to.equal(0)
  })

  it('Should have the correct follows counts 2', async function () {
    await expectAccountFollows(servers[0].url, 'peertube@localhost:9001', 0, 1)
    await expectAccountFollows(servers[0].url, 'peertube@localhost:9002', 1, 0)

    await expectAccountFollows(servers[1].url, 'peertube@localhost:9001', 0, 1)
    await expectAccountFollows(servers[1].url, 'peertube@localhost:9002', 1, 0)

    await expectAccountFollows(servers[2].url, 'peertube@localhost:9001', 0, 0)
    await expectAccountFollows(servers[2].url, 'peertube@localhost:9003', 0, 0)
  })

  it('Should upload a video on server 2 and 3 and propagate only the video of server 2', async function () {
    this.timeout(35000)

    await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'server2' })
    await uploadVideo(servers[2].url, servers[2].accessToken, { name: 'server3' })

    await waitJobs(servers)

    let res = await getVideosList(servers[0].url)
    expect(res.body.total).to.equal(1)
    expect(res.body.data[0].name).to.equal('server2')

    res = await getVideosList(servers[1].url)
    expect(res.body.total).to.equal(1)
    expect(res.body.data[0].name).to.equal('server2')

    res = await getVideosList(servers[2].url)
    expect(res.body.total).to.equal(1)
    expect(res.body.data[0].name).to.equal('server3')
  })

  describe('Should propagate data on a new following', async function () {
    let video4: Video

    before(async function () {
      this.timeout(20000)

      const video4Attributes = {
        name: 'server3-4',
        category: 2,
        nsfw: true,
        licence: 6,
        tags: [ 'tag1', 'tag2', 'tag3' ]
      }

      await uploadVideo(servers[ 2 ].url, servers[ 2 ].accessToken, { name: 'server3-2' })
      await uploadVideo(servers[ 2 ].url, servers[ 2 ].accessToken, { name: 'server3-3' })
      await uploadVideo(servers[ 2 ].url, servers[ 2 ].accessToken, video4Attributes)
      await uploadVideo(servers[ 2 ].url, servers[ 2 ].accessToken, { name: 'server3-5' })
      await uploadVideo(servers[ 2 ].url, servers[ 2 ].accessToken, { name: 'server3-6' })

      {
        const user = { username: 'captain', password: 'password' }
        await createUser(servers[ 2 ].url, servers[ 2 ].accessToken, user.username, user.password)
        const userAccessToken = await userLogin(servers[ 2 ], user)

        const resVideos = await getVideosList(servers[ 2 ].url)
        video4 = resVideos.body.data.find(v => v.name === 'server3-4')

        {
          await rateVideo(servers[ 2 ].url, servers[ 2 ].accessToken, video4.id, 'like')
          await rateVideo(servers[ 2 ].url, userAccessToken, video4.id, 'dislike')
        }

        {
          const text = 'my super first comment'
          const res = await addVideoCommentThread(servers[ 2 ].url, servers[ 2 ].accessToken, video4.id, text)
          const threadId = res.body.comment.id

          const text1 = 'my super answer to thread 1'
          const childCommentRes = await addVideoCommentReply(servers[ 2 ].url, servers[ 2 ].accessToken, video4.id, threadId, text1)
          const childCommentId = childCommentRes.body.comment.id

          const text2 = 'my super answer to answer of thread 1'
          await addVideoCommentReply(servers[ 2 ].url, servers[ 2 ].accessToken, video4.id, childCommentId, text2)

          const text3 = 'my second answer to thread 1'
          await addVideoCommentReply(servers[ 2 ].url, servers[ 2 ].accessToken, video4.id, threadId, text3)
        }

        {
          await createVideoCaption({
            url: servers[2].url,
            accessToken: servers[2].accessToken,
            language: 'ar',
            videoId: video4.id,
            fixture: 'subtitle-good2.vtt'
          })
        }
      }

      await waitJobs(servers)

      // Server 1 follows server 3
      await follow(servers[ 0 ].url, [ servers[ 2 ].url ], servers[ 0 ].accessToken)

      await waitJobs(servers)
    })

    it('Should have the correct follows counts 3', async function () {
      await expectAccountFollows(servers[0].url, 'peertube@localhost:9001', 0, 2)
      await expectAccountFollows(servers[0].url, 'peertube@localhost:9002', 1, 0)
      await expectAccountFollows(servers[0].url, 'peertube@localhost:9003', 1, 0)

      await expectAccountFollows(servers[1].url, 'peertube@localhost:9001', 0, 1)
      await expectAccountFollows(servers[1].url, 'peertube@localhost:9002', 1, 0)

      await expectAccountFollows(servers[2].url, 'peertube@localhost:9001', 0, 2)
      await expectAccountFollows(servers[2].url, 'peertube@localhost:9003', 1, 0)
    })

    it('Should have propagated videos', async function () {
      const res = await getVideosList(servers[ 0 ].url)
      expect(res.body.total).to.equal(7)

      const video2 = res.body.data.find(v => v.name === 'server3-2')
      video4 = res.body.data.find(v => v.name === 'server3-4')
      const video6 = res.body.data.find(v => v.name === 'server3-6')

      expect(video2).to.not.be.undefined
      expect(video4).to.not.be.undefined
      expect(video6).to.not.be.undefined

      const isLocal = false
      const checkAttributes = {
        name: 'server3-4',
        category: 2,
        licence: 6,
        language: 'zh',
        nsfw: true,
        description: 'my super description',
        support: 'my super support text',
        account: {
          name: 'root',
          host: 'localhost:9003'
        },
        isLocal,
        commentsEnabled: true,
        duration: 5,
        tags: [ 'tag1', 'tag2', 'tag3' ],
        privacy: VideoPrivacy.PUBLIC,
        likes: 1,
        dislikes: 1,
        channel: {
          displayName: 'Main root channel',
          name: 'root_channel',
          description: '',
          isLocal
        },
        fixture: 'video_short.webm',
        files: [
          {
            resolution: 720,
            size: 218910
          }
        ]
      }
      await completeVideoCheck(servers[ 0 ].url, video4, checkAttributes)
    })

    it('Should have propagated comments', async function () {
      const res1 = await getVideoCommentThreads(servers[0].url, video4.id, 0, 5)

      expect(res1.body.total).to.equal(1)
      expect(res1.body.data).to.be.an('array')
      expect(res1.body.data).to.have.lengthOf(1)

      const comment: VideoComment = res1.body.data[0]
      expect(comment.inReplyToCommentId).to.be.null
      expect(comment.text).equal('my super first comment')
      expect(comment.videoId).to.equal(video4.id)
      expect(comment.id).to.equal(comment.threadId)
      expect(comment.account.name).to.equal('root')
      expect(comment.account.host).to.equal('localhost:9003')
      expect(comment.totalReplies).to.equal(3)
      expect(dateIsValid(comment.createdAt as string)).to.be.true
      expect(dateIsValid(comment.updatedAt as string)).to.be.true

      const threadId = comment.threadId

      const res2 = await getVideoThreadComments(servers[0].url, video4.id, threadId)

      const tree: VideoCommentThreadTree = res2.body
      expect(tree.comment.text).equal('my super first comment')
      expect(tree.children).to.have.lengthOf(2)

      const firstChild = tree.children[0]
      expect(firstChild.comment.text).to.equal('my super answer to thread 1')
      expect(firstChild.children).to.have.lengthOf(1)

      const childOfFirstChild = firstChild.children[0]
      expect(childOfFirstChild.comment.text).to.equal('my super answer to answer of thread 1')
      expect(childOfFirstChild.children).to.have.lengthOf(0)

      const secondChild = tree.children[1]
      expect(secondChild.comment.text).to.equal('my second answer to thread 1')
      expect(secondChild.children).to.have.lengthOf(0)
    })

    it('Should have propagated captions', async function () {
      const res = await listVideoCaptions(servers[0].url, video4.id)
      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.have.lengthOf(1)

      const caption1: VideoCaption = res.body.data[0]
      expect(caption1.language.id).to.equal('ar')
      expect(caption1.language.label).to.equal('Arabic')
      expect(caption1.captionPath).to.equal('/static/video-captions/' + video4.uuid + '-ar.vtt')
      await testCaptionFile(servers[0].url, caption1.captionPath, 'Subtitle good 2.')
    })

    it('Should unfollow server 3 on server 1 and does not list server 3 videos', async function () {
      this.timeout(5000)

      await unfollow(servers[0].url, servers[0].accessToken, servers[2])

      await waitJobs(servers)

      let res = await getVideosList(servers[ 0 ].url)
      expect(res.body.total).to.equal(1)
    })

  })

  after(async function () {
    killallServers(servers)
  })
})
