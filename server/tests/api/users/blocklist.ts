/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { AccountBlock, ServerBlock, Video } from '../../../../shared/index'
import {
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  flushTests,
  killallServers,
  ServerInfo,
  uploadVideo,
  userLogin
} from '../../utils/index'
import { setAccessTokensToServers } from '../../utils/users/login'
import { getVideosListWithToken, getVideosList } from '../../utils/videos/videos'
import {
  addVideoCommentReply,
  addVideoCommentThread,
  getVideoCommentThreads,
  getVideoThreadComments
} from '../../utils/videos/video-comments'
import { waitJobs } from '../../utils/server/jobs'
import { VideoComment, VideoCommentThreadTree } from '../../../../shared/models/videos/video-comment.model'
import {
  addAccountToAccountBlocklist,
  addAccountToServerBlocklist,
  addServerToAccountBlocklist,
  addServerToServerBlocklist,
  getAccountBlocklistByAccount,
  getAccountBlocklistByServer,
  getServerBlocklistByAccount,
  getServerBlocklistByServer,
  removeAccountFromAccountBlocklist,
  removeAccountFromServerBlocklist,
  removeServerFromAccountBlocklist,
  removeServerFromServerBlocklist
} from '../../utils/users/blocklist'

const expect = chai.expect

async function checkAllVideos (url: string, token: string) {
  {
    const res = await getVideosListWithToken(url, token)

    expect(res.body.data).to.have.lengthOf(4)
  }

  {
    const res = await getVideosList(url)

    expect(res.body.data).to.have.lengthOf(4)
  }
}

async function checkAllComments (url: string, token: string, videoUUID: string) {
  const resThreads = await getVideoCommentThreads(url, videoUUID, 0, 5, '-createdAt', token)

  const threads: VideoComment[] = resThreads.body.data
  expect(threads).to.have.lengthOf(2)

  for (const thread of threads) {
    const res = await getVideoThreadComments(url, videoUUID, thread.id, token)

    const tree: VideoCommentThreadTree = res.body
    expect(tree.children).to.have.lengthOf(1)
  }
}

describe('Test blocklist', function () {
  let servers: ServerInfo[]
  let videoUUID1: string
  let videoUUID2: string
  let userToken1: string
  let userModeratorToken: string
  let userToken2: string

  before(async function () {
    this.timeout(60000)

    await flushTests()

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    {
      const user = { username: 'user1', password: 'password' }
      await createUser(servers[0].url, servers[0].accessToken, user.username, user.password)

      userToken1 = await userLogin(servers[0], user)
      await uploadVideo(servers[0].url, userToken1, { name: 'video user 1' })
    }

    {
      const user = { username: 'moderator', password: 'password' }
      await createUser(servers[0].url, servers[0].accessToken, user.username, user.password)

      userModeratorToken = await userLogin(servers[0], user)
    }

    {
      const user = { username: 'user2', password: 'password' }
      await createUser(servers[1].url, servers[1].accessToken, user.username, user.password)

      userToken2 = await userLogin(servers[1], user)
      await uploadVideo(servers[1].url, userToken2, { name: 'video user 2' })
    }

    {
      const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video server 1' })
      videoUUID1 = res.body.video.uuid
    }

    {
      const res = await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video server 2' })
      videoUUID2 = res.body.video.uuid
    }

    await doubleFollow(servers[0], servers[1])

    {
      const resComment = await addVideoCommentThread(servers[ 0 ].url, servers[ 0 ].accessToken, videoUUID1, 'comment root 1')
      const resReply = await addVideoCommentReply(servers[ 0 ].url, userToken1, videoUUID1, resComment.body.comment.id, 'comment user 1')
      await addVideoCommentReply(servers[ 0 ].url, servers[ 0 ].accessToken, videoUUID1, resReply.body.comment.id, 'comment root 1')
    }

    {
      const resComment = await addVideoCommentThread(servers[ 0 ].url, userToken1, videoUUID1, 'comment user 1')
      await addVideoCommentReply(servers[ 0 ].url, servers[ 0 ].accessToken, videoUUID1, resComment.body.comment.id, 'comment root 1')
    }

    await waitJobs(servers)
  })

  describe('User blocklist', function () {

    describe('When managing account blocklist', function () {
      it('Should list all videos', function () {
        return checkAllVideos(servers[ 0 ].url, servers[ 0 ].accessToken)
      })

      it('Should list the comments', function () {
        return checkAllComments(servers[ 0 ].url, servers[ 0 ].accessToken, videoUUID1)
      })

      it('Should block a remote account', async function () {
        await addAccountToAccountBlocklist(servers[ 0 ].url, servers[ 0 ].accessToken, 'user2@localhost:9002')
      })

      it('Should hide its videos', async function () {
        const res = await getVideosListWithToken(servers[ 0 ].url, servers[ 0 ].accessToken)

        const videos: Video[] = res.body.data
        expect(videos).to.have.lengthOf(3)

        const v = videos.find(v => v.name === 'video user 2')
        expect(v).to.be.undefined
      })

      it('Should block a local account', async function () {
        await addAccountToAccountBlocklist(servers[ 0 ].url, servers[ 0 ].accessToken, 'user1')
      })

      it('Should hide its videos', async function () {
        const res = await getVideosListWithToken(servers[ 0 ].url, servers[ 0 ].accessToken)

        const videos: Video[] = res.body.data
        expect(videos).to.have.lengthOf(2)

        const v = videos.find(v => v.name === 'video user 1')
        expect(v).to.be.undefined
      })

      it('Should hide its comments', async function () {
        const resThreads = await getVideoCommentThreads(servers[ 0 ].url, videoUUID1, 0, 5, '-createdAt', servers[ 0 ].accessToken)

        const threads: VideoComment[] = resThreads.body.data
        expect(threads).to.have.lengthOf(1)
        expect(threads[ 0 ].totalReplies).to.equal(0)

        const t = threads.find(t => t.text === 'comment user 1')
        expect(t).to.be.undefined

        for (const thread of threads) {
          const res = await getVideoThreadComments(servers[ 0 ].url, videoUUID1, thread.id, servers[ 0 ].accessToken)

          const tree: VideoCommentThreadTree = res.body
          expect(tree.children).to.have.lengthOf(0)
        }
      })

      it('Should list all the videos with another user', async function () {
        return checkAllVideos(servers[ 0 ].url, userToken1)
      })

      it('Should list all the comments with another user', async function () {
        return checkAllComments(servers[ 0 ].url, userToken1, videoUUID1)
      })

      it('Should list blocked accounts', async function () {
        {
          const res = await getAccountBlocklistByAccount(servers[ 0 ].url, servers[ 0 ].accessToken, 0, 1, 'createdAt')
          const blocks: AccountBlock[] = res.body.data

          expect(res.body.total).to.equal(2)

          const block = blocks[ 0 ]
          expect(block.byAccount.displayName).to.equal('root')
          expect(block.byAccount.name).to.equal('root')
          expect(block.blockedAccount.displayName).to.equal('user2')
          expect(block.blockedAccount.name).to.equal('user2')
          expect(block.blockedAccount.host).to.equal('localhost:9002')
        }

        {
          const res = await getAccountBlocklistByAccount(servers[ 0 ].url, servers[ 0 ].accessToken, 1, 2, 'createdAt')
          const blocks: AccountBlock[] = res.body.data

          expect(res.body.total).to.equal(2)

          const block = blocks[ 0 ]
          expect(block.byAccount.displayName).to.equal('root')
          expect(block.byAccount.name).to.equal('root')
          expect(block.blockedAccount.displayName).to.equal('user1')
          expect(block.blockedAccount.name).to.equal('user1')
          expect(block.blockedAccount.host).to.equal('localhost:9001')
        }
      })

      it('Should unblock the remote account', async function () {
        await removeAccountFromAccountBlocklist(servers[ 0 ].url, servers[ 0 ].accessToken, 'user2@localhost:9002')
      })

      it('Should display its videos', async function () {
        const res = await getVideosListWithToken(servers[ 0 ].url, servers[ 0 ].accessToken)

        const videos: Video[] = res.body.data
        expect(videos).to.have.lengthOf(3)

        const v = videos.find(v => v.name === 'video user 2')
        expect(v).not.to.be.undefined
      })

      it('Should unblock the local account', async function () {
        await removeAccountFromAccountBlocklist(servers[ 0 ].url, servers[ 0 ].accessToken, 'user1')
      })

      it('Should display its comments', function () {
        return checkAllComments(servers[ 0 ].url, servers[ 0 ].accessToken, videoUUID1)
      })
    })

    describe('When managing server blocklist', function () {
      it('Should list all videos', function () {
        return checkAllVideos(servers[ 0 ].url, servers[ 0 ].accessToken)
      })

      it('Should list the comments', function () {
        return checkAllComments(servers[ 0 ].url, servers[ 0 ].accessToken, videoUUID1)
      })

      it('Should block a remote server', async function () {
        await addServerToAccountBlocklist(servers[ 0 ].url, servers[ 0 ].accessToken, 'localhost:9002')
      })

      it('Should hide its videos', async function () {
        const res = await getVideosListWithToken(servers[ 0 ].url, servers[ 0 ].accessToken)

        const videos: Video[] = res.body.data
        expect(videos).to.have.lengthOf(2)

        const v1 = videos.find(v => v.name === 'video user 2')
        const v2 = videos.find(v => v.name === 'video server 2')

        expect(v1).to.be.undefined
        expect(v2).to.be.undefined
      })

      it('Should list all the videos with another user', async function () {
        return checkAllVideos(servers[ 0 ].url, userToken1)
      })

      it('Should hide its comments')

      it('Should list blocked servers', async function () {
        const res = await getServerBlocklistByAccount(servers[ 0 ].url, servers[ 0 ].accessToken, 0, 1, 'createdAt')
        const blocks: ServerBlock[] = res.body.data

        expect(res.body.total).to.equal(1)

        const block = blocks[ 0 ]
        expect(block.byAccount.displayName).to.equal('root')
        expect(block.byAccount.name).to.equal('root')
        expect(block.blockedServer.host).to.equal('localhost:9002')
      })

      it('Should unblock the remote server', async function () {
        await removeServerFromAccountBlocklist(servers[ 0 ].url, servers[ 0 ].accessToken, 'localhost:9002')
      })

      it('Should display its videos', function () {
        return checkAllVideos(servers[ 0 ].url, servers[ 0 ].accessToken)
      })

      it('Should display its comments', function () {
        return checkAllComments(servers[ 0 ].url, servers[ 0 ].accessToken, videoUUID1)
      })
    })
  })

  describe('Server blocklist', function () {

    describe('When managing account blocklist', function () {
      it('Should list all videos', async function () {
        for (const token of [ userModeratorToken, servers[ 0 ].accessToken ]) {
          await checkAllVideos(servers[ 0 ].url, token)
        }
      })

      it('Should list the comments', async function () {
        for (const token of [ userModeratorToken, servers[ 0 ].accessToken ]) {
          await checkAllComments(servers[ 0 ].url, token, videoUUID1)
        }
      })

      it('Should block a remote account', async function () {
        await addAccountToServerBlocklist(servers[ 0 ].url, servers[ 0 ].accessToken, 'user2@localhost:9002')
      })

      it('Should hide its videos', async function () {
        for (const token of [ userModeratorToken, servers[ 0 ].accessToken ]) {
          const res = await getVideosListWithToken(servers[ 0 ].url, token)

          const videos: Video[] = res.body.data
          expect(videos).to.have.lengthOf(3)

          const v = videos.find(v => v.name === 'video user 2')
          expect(v).to.be.undefined
        }
      })

      it('Should block a local account', async function () {
        await addAccountToServerBlocklist(servers[ 0 ].url, servers[ 0 ].accessToken, 'user1')
      })

      it('Should hide its videos', async function () {
        for (const token of [ userModeratorToken, servers[ 0 ].accessToken ]) {
          const res = await getVideosListWithToken(servers[ 0 ].url, token)

          const videos: Video[] = res.body.data
          expect(videos).to.have.lengthOf(2)

          const v = videos.find(v => v.name === 'video user 1')
          expect(v).to.be.undefined
        }
      })

      it('Should hide its comments', async function () {
        for (const token of [ userModeratorToken, servers[ 0 ].accessToken ]) {
          const resThreads = await getVideoCommentThreads(servers[ 0 ].url, videoUUID1, 0, 5, '-createdAt', token)

          const threads: VideoComment[] = resThreads.body.data
          expect(threads).to.have.lengthOf(1)
          expect(threads[ 0 ].totalReplies).to.equal(0)

          const t = threads.find(t => t.text === 'comment user 1')
          expect(t).to.be.undefined

          for (const thread of threads) {
            const res = await getVideoThreadComments(servers[ 0 ].url, videoUUID1, thread.id, token)

            const tree: VideoCommentThreadTree = res.body
            expect(tree.children).to.have.lengthOf(0)
          }
        }
      })

      it('Should list blocked accounts', async function () {
        {
          const res = await getAccountBlocklistByServer(servers[ 0 ].url, servers[ 0 ].accessToken, 0, 1, 'createdAt')
          const blocks: AccountBlock[] = res.body.data

          expect(res.body.total).to.equal(2)

          const block = blocks[ 0 ]
          expect(block.byAccount.displayName).to.equal('peertube')
          expect(block.byAccount.name).to.equal('peertube')
          expect(block.blockedAccount.displayName).to.equal('user2')
          expect(block.blockedAccount.name).to.equal('user2')
          expect(block.blockedAccount.host).to.equal('localhost:9002')
        }

        {
          const res = await getAccountBlocklistByServer(servers[ 0 ].url, servers[ 0 ].accessToken, 1, 2, 'createdAt')
          const blocks: AccountBlock[] = res.body.data

          expect(res.body.total).to.equal(2)

          const block = blocks[ 0 ]
          expect(block.byAccount.displayName).to.equal('peertube')
          expect(block.byAccount.name).to.equal('peertube')
          expect(block.blockedAccount.displayName).to.equal('user1')
          expect(block.blockedAccount.name).to.equal('user1')
          expect(block.blockedAccount.host).to.equal('localhost:9001')
        }
      })

      it('Should unblock the remote account', async function () {
        await removeAccountFromServerBlocklist(servers[ 0 ].url, servers[ 0 ].accessToken, 'user2@localhost:9002')
      })

      it('Should display its videos', async function () {
        for (const token of [ userModeratorToken, servers[ 0 ].accessToken ]) {
          const res = await getVideosListWithToken(servers[ 0 ].url, token)

          const videos: Video[] = res.body.data
          expect(videos).to.have.lengthOf(3)

          const v = videos.find(v => v.name === 'video user 2')
          expect(v).not.to.be.undefined
        }
      })

      it('Should unblock the local account', async function () {
        await removeAccountFromServerBlocklist(servers[ 0 ].url, servers[ 0 ].accessToken, 'user1')
      })

      it('Should display its comments', async function () {
        for (const token of [ userModeratorToken, servers[ 0 ].accessToken ]) {
          await checkAllComments(servers[ 0 ].url, token, videoUUID1)
        }
      })
    })

    describe('When managing server blocklist', function () {
      it('Should list all videos', async function () {
        for (const token of [ userModeratorToken, servers[ 0 ].accessToken ]) {
          await checkAllVideos(servers[ 0 ].url, token)
        }
      })

      it('Should list the comments', async function () {
        for (const token of [ userModeratorToken, servers[ 0 ].accessToken ]) {
          await checkAllComments(servers[ 0 ].url, token, videoUUID1)
        }
      })

      it('Should block a remote server', async function () {
        await addServerToServerBlocklist(servers[ 0 ].url, servers[ 0 ].accessToken, 'localhost:9002')
      })

      it('Should hide its videos', async function () {
        for (const token of [ userModeratorToken, servers[ 0 ].accessToken ]) {
          const res1 = await getVideosList(servers[ 0 ].url)
          const res2 = await getVideosListWithToken(servers[ 0 ].url, token)

          for (const res of [ res1, res2 ]) {
            const videos: Video[] = res.body.data
            expect(videos).to.have.lengthOf(2)

            const v1 = videos.find(v => v.name === 'video user 2')
            const v2 = videos.find(v => v.name === 'video server 2')

            expect(v1).to.be.undefined
            expect(v2).to.be.undefined
          }
        }
      })

      it('Should hide its comments')

      it('Should list blocked servers', async function () {
        const res = await getServerBlocklistByServer(servers[ 0 ].url, servers[ 0 ].accessToken, 0, 1, 'createdAt')
        const blocks: ServerBlock[] = res.body.data

        expect(res.body.total).to.equal(1)

        const block = blocks[ 0 ]
        expect(block.byAccount.displayName).to.equal('peertube')
        expect(block.byAccount.name).to.equal('peertube')
        expect(block.blockedServer.host).to.equal('localhost:9002')
      })

      it('Should unblock the remote server', async function () {
        await removeServerFromServerBlocklist(servers[ 0 ].url, servers[ 0 ].accessToken, 'localhost:9002')
      })

      it('Should list all videos', async function () {
        for (const token of [ userModeratorToken, servers[ 0 ].accessToken ]) {
          await checkAllVideos(servers[ 0 ].url, token)
        }
      })

      it('Should list the comments', async function () {
        for (const token of [ userModeratorToken, servers[ 0 ].accessToken ]) {
          await checkAllComments(servers[ 0 ].url, token, videoUUID1)
        }
      })
    })
  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this[ 'ok' ]) {
      await flushTests()
    }
  })
})
