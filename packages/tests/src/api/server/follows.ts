/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { Video, VideoCommentPolicy, VideoPrivacy } from '@peertube/peertube-models'
import { PeerTubeServer, cleanupTests, createMultipleServers, setAccessTokensToServers, waitJobs } from '@peertube/peertube-server-commands'
import { expectAccountFollows, expectChannelsFollows } from '@tests/shared/actors.js'
import { testCaptionFile } from '@tests/shared/captions.js'
import { dateIsValid } from '@tests/shared/checks.js'
import { completeVideoCheck } from '@tests/shared/videos.js'
import { expect } from 'chai'

describe('Test follows', function () {

  describe('Complex follow', function () {
    let servers: PeerTubeServer[] = []

    before(async function () {
      this.timeout(120000)

      servers = await createMultipleServers(3)

      // Get the access tokens
      await setAccessTokensToServers(servers)
    })

    describe('Data propagation after follow', function () {

      it('Should not have followers/followings', async function () {
        for (const server of servers) {
          const bodies = await Promise.all([
            server.follows.getFollowers({ start: 0, count: 5, sort: 'createdAt' }),
            server.follows.getFollowings({ start: 0, count: 5, sort: 'createdAt' })
          ])

          for (const body of bodies) {
            expect(body.total).to.equal(0)

            const follows = body.data
            expect(follows).to.be.an('array')
            expect(follows).to.have.lengthOf(0)
          }
        }
      })

      it('Should have server 1 following root account of server 2 and server 3', async function () {
        this.timeout(60000)

        await servers[0].follows.follow({
          hosts: [ servers[2].url ],
          handles: [ 'root@' + servers[1].host ]
        })

        await waitJobs(servers)
      })

      it('Should have 2 followings on server 1', async function () {
        const body = await servers[0].follows.getFollowings({ start: 0, count: 1, sort: 'createdAt' })
        expect(body.total).to.equal(2)

        let follows = body.data
        expect(follows).to.be.an('array')
        expect(follows).to.have.lengthOf(1)

        const body2 = await servers[0].follows.getFollowings({ start: 1, count: 1, sort: 'createdAt' })
        follows = follows.concat(body2.data)

        const server2Follow = follows.find(f => f.following.host === servers[1].host)
        const server3Follow = follows.find(f => f.following.host === servers[2].host)

        expect(server2Follow).to.not.be.undefined
        expect(server2Follow.following.name).to.equal('root')
        expect(server2Follow.state).to.equal('accepted')

        expect(server3Follow).to.not.be.undefined
        expect(server3Follow.following.name).to.equal('peertube')
        expect(server3Follow.state).to.equal('accepted')
      })

      it('Should have 0 followings on server 2 and 3', async function () {
        for (const server of [ servers[1], servers[2] ]) {
          const body = await server.follows.getFollowings({ start: 0, count: 5, sort: 'createdAt' })
          expect(body.total).to.equal(0)

          const follows = body.data
          expect(follows).to.be.an('array')
          expect(follows).to.have.lengthOf(0)
        }
      })

      it('Should have 1 followers on server 3', async function () {
        const body = await servers[2].follows.getFollowers({ start: 0, count: 1, sort: 'createdAt' })
        expect(body.total).to.equal(1)

        const follows = body.data
        expect(follows).to.be.an('array')
        expect(follows).to.have.lengthOf(1)
        expect(follows[0].follower.host).to.equal(servers[0].host)
      })

      it('Should have 0 followers on server 1 and 2', async function () {
        for (const server of [ servers[0], servers[1] ]) {
          const body = await server.follows.getFollowers({ start: 0, count: 5, sort: 'createdAt' })
          expect(body.total).to.equal(0)

          const follows = body.data
          expect(follows).to.be.an('array')
          expect(follows).to.have.lengthOf(0)
        }
      })

      it('Should search/filter followings on server 1', async function () {
        const sort = 'createdAt'
        const start = 0
        const count = 1

        {
          const search = ':' + servers[1].port

          {
            const body = await servers[0].follows.getFollowings({ start, count, sort, search })
            expect(body.total).to.equal(1)

            const follows = body.data
            expect(follows).to.have.lengthOf(1)
            expect(follows[0].following.host).to.equal(servers[1].host)
          }

          {
            const body = await servers[0].follows.getFollowings({ start, count, sort, search, state: 'accepted' })
            expect(body.total).to.equal(1)
            expect(body.data).to.have.lengthOf(1)
          }

          {
            const body = await servers[0].follows.getFollowings({ start, count, sort, search, state: 'accepted', actorType: 'Person' })
            expect(body.total).to.equal(1)
            expect(body.data).to.have.lengthOf(1)
          }

          {
            const body = await servers[0].follows.getFollowings({
              start,
              count,
              sort,
              search,
              state: 'accepted',
              actorType: 'Application'
            })
            expect(body.total).to.equal(0)
            expect(body.data).to.have.lengthOf(0)
          }

          {
            const body = await servers[0].follows.getFollowings({ start, count, sort, search, state: 'pending' })
            expect(body.total).to.equal(0)
            expect(body.data).to.have.lengthOf(0)
          }
        }

        {
          const body = await servers[0].follows.getFollowings({ start, count, sort, search: 'root' })
          expect(body.total).to.equal(1)
          expect(body.data).to.have.lengthOf(1)
        }

        {
          const body = await servers[0].follows.getFollowings({ start, count, sort, search: 'bla' })
          expect(body.total).to.equal(0)

          expect(body.data).to.have.lengthOf(0)
        }
      })

      it('Should search/filter followers on server 2', async function () {
        const start = 0
        const count = 5
        const sort = 'createdAt'

        {
          const search = servers[0].port + ''

          {
            const body = await servers[2].follows.getFollowers({ start, count, sort, search })
            expect(body.total).to.equal(1)

            const follows = body.data
            expect(follows).to.have.lengthOf(1)
            expect(follows[0].following.host).to.equal(servers[2].host)
          }

          {
            const body = await servers[2].follows.getFollowers({ start, count, sort, search, state: 'accepted' })
            expect(body.total).to.equal(1)
            expect(body.data).to.have.lengthOf(1)
          }

          {
            const body = await servers[2].follows.getFollowers({ start, count, sort, search, state: 'accepted', actorType: 'Person' })
            expect(body.total).to.equal(0)
            expect(body.data).to.have.lengthOf(0)
          }

          {
            const body = await servers[2].follows.getFollowers({
              start,
              count,
              sort,
              search,
              state: 'accepted',
              actorType: 'Application'
            })
            expect(body.total).to.equal(1)
            expect(body.data).to.have.lengthOf(1)
          }

          {
            const body = await servers[2].follows.getFollowers({ start, count, sort, search, state: 'pending' })
            expect(body.total).to.equal(0)
            expect(body.data).to.have.lengthOf(0)
          }
        }

        {
          const body = await servers[2].follows.getFollowers({ start, count, sort, search: 'bla' })
          expect(body.total).to.equal(0)

          const follows = body.data
          expect(follows).to.have.lengthOf(0)
        }
      })

      it('Should have the correct follows counts', async function () {
        await expectAccountFollows({ server: servers[0], handle: 'peertube@' + servers[0].host, followers: 0, following: 2 })
        await expectAccountFollows({ server: servers[0], handle: 'root@' + servers[1].host, followers: 1, following: 0 })
        await expectAccountFollows({ server: servers[0], handle: 'peertube@' + servers[2].host, followers: 1, following: 0 })

        // Server 2 and 3 does not know server 1 follow another server (there was not a refresh)
        await expectAccountFollows({ server: servers[1], handle: 'peertube@' + servers[0].host, followers: 0, following: 1 })
        await expectAccountFollows({ server: servers[1], handle: 'root@' + servers[1].host, followers: 1, following: 0 })
        await expectAccountFollows({ server: servers[1], handle: 'peertube@' + servers[1].host, followers: 0, following: 0 })

        await expectAccountFollows({ server: servers[2], handle: 'peertube@' + servers[0].host, followers: 0, following: 1 })
        await expectAccountFollows({ server: servers[2], handle: 'peertube@' + servers[2].host, followers: 1, following: 0 })
      })

      it('Should unfollow server 3 on server 1', async function () {
        this.timeout(15000)

        await servers[0].follows.unfollow({ target: servers[2] })

        await waitJobs(servers)
      })

      it('Should not follow server 3 on server 1 anymore', async function () {
        const body = await servers[0].follows.getFollowings({ start: 0, count: 2, sort: 'createdAt' })
        expect(body.total).to.equal(1)

        const follows = body.data
        expect(follows).to.be.an('array')
        expect(follows).to.have.lengthOf(1)

        expect(follows[0].following.host).to.equal(servers[1].host)
      })

      it('Should not have server 1 as follower on server 3 anymore', async function () {
        const body = await servers[2].follows.getFollowers({ start: 0, count: 1, sort: 'createdAt' })
        expect(body.total).to.equal(0)

        const follows = body.data
        expect(follows).to.be.an('array')
        expect(follows).to.have.lengthOf(0)
      })

      it('Should have the correct follows counts after the unfollow', async function () {
        await expectAccountFollows({ server: servers[0], handle: 'peertube@' + servers[0].host, followers: 0, following: 1 })
        await expectAccountFollows({ server: servers[0], handle: 'root@' + servers[1].host, followers: 1, following: 0 })
        await expectAccountFollows({ server: servers[0], handle: 'peertube@' + servers[2].host, followers: 0, following: 0 })

        await expectAccountFollows({ server: servers[1], handle: 'peertube@' + servers[0].host, followers: 0, following: 1 })
        await expectAccountFollows({ server: servers[1], handle: 'root@' + servers[1].host, followers: 1, following: 0 })
        await expectAccountFollows({ server: servers[1], handle: 'peertube@' + servers[1].host, followers: 0, following: 0 })

        await expectAccountFollows({ server: servers[2], handle: 'peertube@' + servers[0].host, followers: 0, following: 0 })
        await expectAccountFollows({ server: servers[2], handle: 'peertube@' + servers[2].host, followers: 0, following: 0 })
      })

      it('Should upload a video on server 2 and 3 and propagate only the video of server 2', async function () {
        this.timeout(160000)

        await servers[1].videos.upload({ attributes: { name: 'server2' } })
        await servers[2].videos.upload({ attributes: { name: 'server3' } })

        await waitJobs(servers)

        {
          const { total, data } = await servers[0].videos.list()
          expect(total).to.equal(1)
          expect(data[0].name).to.equal('server2')
        }

        {
          const { total, data } = await servers[1].videos.list()
          expect(total).to.equal(1)
          expect(data[0].name).to.equal('server2')
        }

        {
          const { total, data } = await servers[2].videos.list()
          expect(total).to.equal(1)
          expect(data[0].name).to.equal('server3')
        }
      })

      it('Should remove account follow', async function () {
        this.timeout(15000)

        await servers[0].follows.unfollow({ target: 'root@' + servers[1].host })

        await waitJobs(servers)
      })

      it('Should have removed the account follow', async function () {
        await expectAccountFollows({ server: servers[0], handle: 'root@' + servers[1].host, followers: 0, following: 0 })
        await expectAccountFollows({ server: servers[1], handle: 'root@' + servers[1].host, followers: 0, following: 0 })

        {
          const { total, data } = await servers[0].follows.getFollowings()
          expect(total).to.equal(0)
          expect(data).to.have.lengthOf(0)
        }

        {
          const { total, data } = await servers[0].videos.list()
          expect(total).to.equal(0)
          expect(data).to.have.lengthOf(0)
        }
      })

      it('Should follow a channel', async function () {
        this.timeout(15000)

        await servers[0].follows.follow({
          handles: [ 'root_channel@' + servers[1].host ]
        })

        await waitJobs(servers)

        await expectChannelsFollows({ server: servers[0], handle: 'root_channel@' + servers[1].host, followers: 1, following: 0 })
        await expectChannelsFollows({ server: servers[1], handle: 'root_channel@' + servers[1].host, followers: 1, following: 0 })

        {
          const { total, data } = await servers[0].follows.getFollowings()
          expect(total).to.equal(1)
          expect(data).to.have.lengthOf(1)
        }

        {
          const { total, data } = await servers[0].videos.list()
          expect(total).to.equal(1)
          expect(data).to.have.lengthOf(1)
        }
      })
    })

    describe('Should propagate data on a new server follow', function () {
      let video4: Video

      before(async function () {
        this.timeout(240000)

        const video4Attributes = {
          name: 'server3-4',
          category: 2,
          nsfw: true,
          licence: 6,
          tags: [ 'tag1', 'tag2', 'tag3' ]
        }

        await servers[2].videos.upload({ attributes: { name: 'server3-2' } })
        await servers[2].videos.upload({ attributes: { name: 'server3-3' } })

        const video4CreateResult = await servers[2].videos.upload({ attributes: video4Attributes })

        await servers[2].videos.upload({ attributes: { name: 'server3-5' } })
        await servers[2].videos.upload({ attributes: { name: 'server3-6' } })

        {
          const userAccessToken = await servers[2].users.generateUserAndToken('captain')

          await servers[2].videos.rate({ id: video4CreateResult.id, rating: 'like' })
          await servers[2].videos.rate({ token: userAccessToken, id: video4CreateResult.id, rating: 'dislike' })
        }

        {
          await servers[2].comments.createThread({ videoId: video4CreateResult.id, text: 'my super first comment' })

          await servers[2].comments.addReplyToLastThread({ text: 'my super answer to thread 1' })
          await servers[2].comments.addReplyToLastReply({ text: 'my super answer to answer of thread 1' })
          await servers[2].comments.addReplyToLastThread({ text: 'my second answer to thread 1' })
        }

        {
          const { id: threadId } = await servers[2].comments.createThread({ videoId: video4CreateResult.id, text: 'will be deleted' })
          await servers[2].comments.addReplyToLastThread({ text: 'answer to deleted' })

          const { id: replyId } = await servers[2].comments.addReplyToLastThread({ text: 'will also be deleted' })

          await servers[2].comments.addReplyToLastReply({ text: 'my second answer to deleted' })

          await servers[2].comments.delete({ videoId: video4CreateResult.id, commentId: threadId })
          await servers[2].comments.delete({ videoId: video4CreateResult.id, commentId: replyId })
        }

        await servers[2].captions.add({
          language: 'ar',
          videoId: video4CreateResult.id,
          fixture: 'subtitle-good2.vtt'
        })

        await waitJobs(servers)

        // Server 1 follows server 3
        await servers[0].follows.follow({ hosts: [ servers[2].url ] })

        await waitJobs(servers)
      })

      it('Should have the correct follows counts', async function () {
        await expectAccountFollows({ server: servers[0], handle: 'peertube@' + servers[0].host, followers: 0, following: 2 })
        await expectAccountFollows({ server: servers[0], handle: 'root@' + servers[1].host, followers: 0, following: 0 })
        await expectChannelsFollows({ server: servers[0], handle: 'root_channel@' + servers[1].host, followers: 1, following: 0 })
        await expectAccountFollows({ server: servers[0], handle: 'peertube@' + servers[2].host, followers: 1, following: 0 })

        await expectAccountFollows({ server: servers[1], handle: 'peertube@' + servers[0].host, followers: 0, following: 1 })
        await expectAccountFollows({ server: servers[1], handle: 'peertube@' + servers[1].host, followers: 0, following: 0 })
        await expectAccountFollows({ server: servers[1], handle: 'root@' + servers[1].host, followers: 0, following: 0 })
        await expectChannelsFollows({ server: servers[1], handle: 'root_channel@' + servers[1].host, followers: 1, following: 0 })

        await expectAccountFollows({ server: servers[2], handle: 'peertube@' + servers[0].host, followers: 0, following: 1 })
        await expectAccountFollows({ server: servers[2], handle: 'peertube@' + servers[2].host, followers: 1, following: 0 })
      })

      it('Should have propagated videos', async function () {
        const { total, data } = await servers[0].videos.list()
        expect(total).to.equal(7)

        const video2 = data.find(v => v.name === 'server3-2')
        video4 = data.find(v => v.name === 'server3-4')
        const video6 = data.find(v => v.name === 'server3-6')

        expect(video2).to.not.be.undefined
        expect(video4).to.not.be.undefined
        expect(video6).to.not.be.undefined

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
            host: servers[2].host
          },
          commentsPolicy: VideoCommentPolicy.ENABLED,
          downloadEnabled: true,
          duration: 5,
          tags: [ 'tag1', 'tag2', 'tag3' ],
          privacy: VideoPrivacy.PUBLIC,
          likes: 1,
          dislikes: 1,
          channel: {
            displayName: 'Main root channel',
            name: 'root_channel',
            description: ''
          },
          fixture: 'video_short.webm',
          files: [
            {
              resolution: 720,
              width: 1280,
              height: 720,
              size: 218910
            }
          ]
        }
        await completeVideoCheck({
          server: servers[0],
          originServer: servers[2],
          videoUUID: video4.uuid,
          attributes: checkAttributes
        })
      })

      it('Should have propagated comments', async function () {
        const { total, data } = await servers[0].comments.listThreads({ videoId: video4.id, sort: 'createdAt' })

        expect(total).to.equal(2)
        expect(data).to.be.an('array')
        expect(data).to.have.lengthOf(2)

        {
          const comment = data[0]
          expect(comment.inReplyToCommentId).to.be.null
          expect(comment.text).equal('my super first comment')
          expect(comment.videoId).to.equal(video4.id)
          expect(comment.id).to.equal(comment.threadId)
          expect(comment.account.name).to.equal('root')
          expect(comment.account.host).to.equal(servers[2].host)
          expect(comment.totalReplies).to.equal(3)
          expect(dateIsValid(comment.createdAt as string)).to.be.true
          expect(dateIsValid(comment.updatedAt as string)).to.be.true

          const threadId = comment.threadId

          const tree = await servers[0].comments.getThread({ videoId: video4.id, threadId })
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
        }

        {
          const deletedComment = data[1]
          expect(deletedComment).to.not.be.undefined
          expect(deletedComment.isDeleted).to.be.true
          expect(deletedComment.deletedAt).to.not.be.null
          expect(deletedComment.text).to.equal('')
          expect(deletedComment.inReplyToCommentId).to.be.null
          expect(deletedComment.account).to.be.null
          expect(deletedComment.totalReplies).to.equal(2)
          expect(dateIsValid(deletedComment.deletedAt as string)).to.be.true

          const tree = await servers[0].comments.getThread({ videoId: video4.id, threadId: deletedComment.threadId })
          const [ commentRoot, deletedChildRoot ] = tree.children

          expect(deletedChildRoot).to.not.be.undefined
          expect(deletedChildRoot.comment.isDeleted).to.be.true
          expect(deletedChildRoot.comment.deletedAt).to.not.be.null
          expect(deletedChildRoot.comment.text).to.equal('')
          expect(deletedChildRoot.comment.inReplyToCommentId).to.equal(deletedComment.id)
          expect(deletedChildRoot.comment.account).to.be.null
          expect(deletedChildRoot.children).to.have.lengthOf(1)

          const answerToDeletedChild = deletedChildRoot.children[0]
          expect(answerToDeletedChild.comment).to.not.be.undefined
          expect(answerToDeletedChild.comment.inReplyToCommentId).to.equal(deletedChildRoot.comment.id)
          expect(answerToDeletedChild.comment.text).to.equal('my second answer to deleted')
          expect(answerToDeletedChild.comment.account.name).to.equal('root')

          expect(commentRoot.comment).to.not.be.undefined
          expect(commentRoot.comment.inReplyToCommentId).to.equal(deletedComment.id)
          expect(commentRoot.comment.text).to.equal('answer to deleted')
          expect(commentRoot.comment.account.name).to.equal('root')
        }
      })

      it('Should have propagated captions', async function () {
        const body = await servers[0].captions.list({ videoId: video4.id })
        expect(body.total).to.equal(1)
        expect(body.data).to.have.lengthOf(1)

        const caption1 = body.data[0]
        expect(caption1.language.id).to.equal('ar')
        expect(caption1.language.label).to.equal('Arabic')
        expect(caption1.captionPath).to.match(new RegExp('^/lazy-static/video-captions/.+-ar.vtt$'))
        await testCaptionFile(caption1.fileUrl, 'Subtitle good 2.')
      })

      it('Should unfollow server 3 on server 1 and does not list server 3 videos', async function () {
        this.timeout(5000)

        await servers[0].follows.unfollow({ target: servers[2] })

        await waitJobs(servers)

        const { total } = await servers[0].videos.list()
        expect(total).to.equal(1)
      })
    })

    after(async function () {
      await cleanupTests(servers)
    })
  })

  describe('Simple data propagation propagate data on a new channel follow', function () {
    let servers: PeerTubeServer[] = []

    before(async function () {
      this.timeout(120000)

      servers = await createMultipleServers(3)
      await setAccessTokensToServers(servers)

      await servers[0].videos.upload({ attributes: { name: 'video to add' } })

      await waitJobs(servers)

      for (const server of [ servers[1], servers[2] ]) {
        const video = await server.videos.find({ name: 'video to add' })
        expect(video).to.not.exist
      }
    })

    it('Should have propagated video after new channel follow', async function () {
      this.timeout(60000)

      await servers[1].follows.follow({ handles: [ 'root_channel@' + servers[0].host ] })

      await waitJobs(servers)

      const video = await servers[1].videos.find({ name: 'video to add' })
      expect(video).to.exist
    })

    it('Should have propagated video after new account follow', async function () {
      this.timeout(60000)

      await servers[2].follows.follow({ handles: [ 'root@' + servers[0].host ] })

      await waitJobs(servers)

      const video = await servers[2].videos.find({ name: 'video to add' })
      expect(video).to.exist
    })

    after(async function () {
      await cleanupTests(servers)
    })
  })
})
