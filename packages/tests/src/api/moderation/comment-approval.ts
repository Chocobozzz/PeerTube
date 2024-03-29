/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  ActivityApproveReply,
  ActivityPubOrderedCollection,
  HttpStatusCode,
  UserRole,
  VideoCommentObject,
  VideoCommentPolicy,
  VideoCommentPolicyType,
  VideoPrivacy
} from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests, createMultipleServers,
  doubleFollow,
  makeActivityPubGetRequest, makeActivityPubRawRequest, setAccessTokensToServers,
  setDefaultAccountAvatar,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectStartWith } from '@tests/shared/checks.js'
import { expect } from 'chai'

describe('Test comments approval', function () {
  let servers: PeerTubeServer[]
  let userToken: string
  let anotherUserToken: string
  let moderatorToken: string

  async function createVideo (commentsPolicy: VideoCommentPolicyType) {
    const { uuid } = await servers[0].videos.upload({
      token: userToken,
      attributes: {
        name: 'review policy: ' + commentsPolicy,
        privacy: VideoPrivacy.PUBLIC,
        commentsPolicy
      }
    })

    await waitJobs(servers)

    return uuid
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(3)
    await setAccessTokensToServers(servers)
    await setDefaultAccountAvatar(servers)

    await doubleFollow(servers[0], servers[1])
    await doubleFollow(servers[0], servers[2])
    await doubleFollow(servers[1], servers[2])

    userToken = await servers[0].users.generateUserAndToken('user1')
    anotherUserToken = await servers[0].users.generateUserAndToken('user2')
    moderatorToken = await servers[0].users.generateUserAndToken('moderator', UserRole.MODERATOR)
  })

  describe('On video with comments requiring approval', function () {
    let videoId: string

    before(async function () {
      this.timeout(30000)

      videoId = await createVideo(VideoCommentPolicy.REQUIRES_APPROVAL)
    })

    it('Should create a local and remote comment that require approval', async function () {
      this.timeout(30000)

      await servers[0].comments.createThread({ text: 'local', videoId, token: anotherUserToken })
      await servers[1].comments.createThread({ text: 'remote', videoId })
      await waitJobs(servers)

      const { data } = await servers[0].comments.listCommentsOnMyVideos({ token: userToken })
      expect(data).to.have.lengthOf(2)

      for (const c of data) {
        expect(c.heldForReview).to.be.true
      }
    })

    it('Should display comments depending on the user', async function () {
      // Owner see the comments
      {
        const { data } = await servers[0].comments.listThreads({ videoId, token: userToken })
        expect(data).to.have.lengthOf(2)

        for (const c of data) {
          expect(c.heldForReview).to.be.true
        }
      }

      // Anonymous doesn't see the comments
      for (const server of servers) {
        const { data } = await server.comments.listThreads({ videoId })
        expect(data).to.have.lengthOf(0)
      }

      // Owner of the comment can see it
      {
        const { data } = await servers[1].comments.listThreads({ videoId, token: servers[1].accessToken })
        expect(data).to.have.lengthOf(1)
        expect(data[0].heldForReview).to.be.true
        expect(data[0].text).to.equal('remote')
      }
    })

    it('Should create a local and remote reply and require approval', async function () {
      await servers[0].comments.addReplyToLastThread({ text: 'local reply', token: anotherUserToken })
      await servers[1].comments.addReplyToLastThread({ text: 'remote reply' })
      await waitJobs(servers)

      const { data } = await servers[0].comments.listCommentsOnMyVideos({ token: userToken })
      expect(data).to.have.lengthOf(4)

      for (const c of data) {
        expect(c.heldForReview).to.be.true
      }
    })

    it('Should approve a thread comment', async function () {
      {
        const { data } = await servers[0].comments.listCommentsOnMyVideos({ token: userToken })
        const commentId = data.find(c => c.text === 'remote').id
        await servers[0].comments.approve({ commentId, videoId, token: userToken })
        await waitJobs(servers)
      }

      // Owner and moderators
      for (const token of [ userToken, moderatorToken ]) {
        const { data: threads } = await servers[0].comments.listThreads({ videoId, token })
        expect(threads).to.have.lengthOf(2)

        for (const c of threads) {
          if (c.text === 'remote') expect(c.heldForReview).to.be.false
          else expect(c.heldForReview).to.be.true

          const thread = await servers[0].comments.getThread({ videoId, threadId: c.id, token })
          expect(thread.children).to.have.lengthOf(1)
          expect(thread.children[0].comment.heldForReview).to.equal(true)
        }
      }

      // Anonymous
      for (const server of servers) {
        const { data } = await server.comments.listThreads({ videoId })
        expect(data).to.have.lengthOf(1)
        expect(data[0].heldForReview).to.be.false
        expect(data[0].text).to.equal('remote')

        const thread = await server.comments.getThread({ videoId, threadId: data[0].id })
        expect(thread.children).to.have.lengthOf(0)
      }

      // Owner of the comment can see it
      {
        const { data } = await servers[1].comments.listThreads({ videoId, token: servers[1].accessToken })
        expect(data).to.have.lengthOf(1)
        expect(data[0].heldForReview).to.be.false
        expect(data[0].text).to.equal('remote')

        const thread = await servers[1].comments.getThread({ videoId, threadId: data[0].id, token: servers[1].accessToken })
        expect(thread.children).to.have.lengthOf(1)
        expect(thread.children[0].comment.heldForReview).to.equal(true)
      }
    })

    it('Should approve a reply comment', async function () {
      {
        const commentId = await servers[0].comments.findCommentId({ videoId, text: 'remote reply' })
        await servers[0].comments.approve({ commentId, videoId, token: userToken })
        await waitJobs(servers)

        // Owner
        {
          const { data } = await servers[0].comments.listThreads({ videoId, token: userToken })
          expect(data.filter(c => c.heldForReview)).to.have.lengthOf(1)

          const thread = await servers[0].comments.getThreadOf({ videoId, text: 'remote', token: userToken })
          expect(thread.children).to.have.lengthOf(1)
          expect(thread.children[0].comment.text).to.equal('remote reply')
          expect(thread.children[0].comment.heldForReview).to.be.false
        }

        // Other users
        for (const server of servers) {
          const thread = await server.comments.getThreadOf({ videoId, text: 'remote' })
          expect(thread.children).to.have.lengthOf(1)
          expect(thread.children[0].comment.text).to.equal('remote reply')
          expect(thread.children[0].comment.heldForReview).to.be.false
        }
      }
    })

    it('Should list and filter on comments awaiting approval', async function () {
      {
        const { total, data } = await servers[0].comments.listCommentsOnMyVideos({ videoId, token: userToken })
        expect(total).to.equal(4)
        expect(data).to.have.lengthOf(4)
      }

      {
        const { total, data } = await servers[0].comments.listCommentsOnMyVideos({ videoId, token: userToken, isHeldForReview: true })
        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(2)
        expect(data.filter(c => c.heldForReview)).to.have.lengthOf(2)
      }

      {
        const { total, data } = await servers[0].comments.listCommentsOnMyVideos({ videoId, token: userToken, isHeldForReview: false })
        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(2)
        expect(data.filter(c => !c.heldForReview)).to.have.lengthOf(2)
      }
    })

    it('Should approve a reply of a non approved reply', async function () {
      const threadId = await servers[0].comments.findCommentId({ videoId, text: 'local' })

      const { id: replyId } = await servers[0].comments.addReply({
        videoId,
        toCommentId: await servers[0].comments.findCommentId({ videoId, text: 'local reply' }),
        text: 'local reply 2',
        token: anotherUserToken
      })

      await servers[0].comments.approve({ commentId: replyId, videoId, token: userToken })
      await servers[0].comments.approve({ commentId: threadId, videoId, token: userToken })
      await waitJobs(servers)

      // Owner
      {
        const { data } = await servers[0].comments.listThreads({ videoId, token: userToken })
        expect(data.filter(c => c.heldForReview)).to.have.lengthOf(0)

        const thread = await servers[0].comments.getThreadOf({ videoId, text: 'local', token: userToken })
        expect(thread.children).to.have.lengthOf(1)
        expect(thread.children[0].comment.text).to.equal('local reply')
        expect(thread.children[0].comment.heldForReview).to.be.true

        expect(thread.children[0].children).to.have.lengthOf(1)
        expect(thread.children[0].children[0].comment.text).to.equal('local reply 2')
        expect(thread.children[0].children[0].comment.heldForReview).to.be.false
      }

      // Other users
      for (const server of servers) {
        const thread = await server.comments.getThreadOf({ videoId, text: 'local' })
        expect(thread.children).to.have.lengthOf(0)
      }
    })

    it('Should have appropriate ActivityPub representation', async function () {
      const localNonApprovedId = await servers[0].comments.findCommentId({ text: 'local reply', videoId })
      const localApprovedId = await servers[0].comments.findCommentId({ text: 'local', videoId })
      const remoteApprovedId = await servers[0].comments.findCommentId({ text: 'remote', videoId })

      {
        for (const page of [ 1, 2 ]) {
          const res = await makeActivityPubGetRequest(servers[0].url, `/videos/watch/${videoId}/comments?page=${page}`)
          const { totalItems, orderedItems } = res.body as ActivityPubOrderedCollection<string>

          expect(totalItems).to.equal(4)
          expect(orderedItems.some(url => url === `${servers[0].url}/videos/watch/${videoId}/comments/${localNonApprovedId}`)).to.be.false
        }
      }

      {
        await makeActivityPubGetRequest(
          servers[0].url,
          `/videos/watch/${videoId}/comments/${localNonApprovedId}`,
          HttpStatusCode.NOT_FOUND_404
        )

        await makeActivityPubGetRequest(
          servers[0].url,
          `/videos/watch/${videoId}/comments/${localNonApprovedId}/approve-reply`,
          HttpStatusCode.NOT_FOUND_404
        )
      }

      const toTest = [ { server: servers[0], commentId: localApprovedId }, { server: servers[1], commentId: remoteApprovedId } ]
      for (const { server, commentId } of toTest) {
        const res = await makeActivityPubGetRequest(server.url, `/videos/watch/${videoId}/comments/${commentId}`)
        const { replyApproval } = res.body as VideoCommentObject

        expectStartWith(replyApproval, `${servers[0].url}/videos/watch/${videoId}/comments/`)
        const res2 = await makeActivityPubRawRequest(replyApproval, HttpStatusCode.OK_200)

        const object = res2.body as ActivityApproveReply
        expect(object.type).to.equal('ApproveReply')
      }
    })

    it('Should remove an approved/non-approved comments', async function () {
      this.timeout(60000)

      {
        const commentId = await servers[1].comments.findCommentId({ videoId, text: 'local' })
        await servers[1].comments.addReply({ videoId, toCommentId: commentId, text: 'remote reply on local' })
        await waitJobs(servers)
      }

      for (const text of [ 'remote', 'local reply', 'remote reply on local' ]) {
        const commentId = await servers[0].comments.findCommentId({ videoId, text })
        await servers[0].comments.delete({ videoId, commentId })
      }

      await waitJobs(servers)

      // Owner
      {
        const { data } = await servers[0].comments.listThreads({ videoId, token: userToken, sort: '-createdAt' })
        expect(data).to.have.lengthOf(2)

        {
          const remote = data[0]
          expect(remote.isDeleted).to.be.true

          const thread = await servers[0].comments.getThread({ videoId, token: userToken, threadId: remote.id })
          expect(thread.children).to.have.lengthOf(1)
          expect(thread.children[0].comment.text).to.equal('remote reply')
        }

        {
          const local = data[1]
          expect(local.isDeleted).to.be.false

          const thread = await servers[0].comments.getThread({ videoId, token: userToken, threadId: local.id })
          expect(thread.children).to.have.lengthOf(2)

          {
            const localReply = thread.children[0]
            expect(localReply.comment.deletedAt).to.exist
            expect(localReply.comment.heldForReview).to.be.true
            expect(localReply.children).to.have.lengthOf(1)

            expect(localReply.children).to.have.lengthOf(1)
            expect(localReply.children[0].comment.text).to.equal('local reply 2')
            expect(localReply.children[0].comment.heldForReview).to.be.false
            expect(localReply.children[0].children).to.have.lengthOf(0)
          }

          {
            expect(thread.children[1].comment.deletedAt).to.exist
          }
        }
      }

      // Other users
      for (const server of servers) {
        const { data } = await server.comments.listThreads({ videoId, sort: '-createdAt' })
        expect(data).to.have.lengthOf(2)

        {
          const remote = data[0]
          expect(remote.isDeleted).to.be.true

          const thread = await server.comments.getThread({ videoId, threadId: remote.id })
          expect(thread.children).to.have.lengthOf(1)
          expect(thread.children[0].comment.text).to.equal('remote reply')
        }

        {
          const local = data[1]
          expect(local.isDeleted).to.be.false

          const thread = await server.comments.getThread({ videoId, threadId: local.id })
          // Anonymous users cannot see the thread because the delete comment was held for review
          expect(thread.children).to.have.lengthOf(0)
        }
      }
    })

    it('Should not require review for video uploader, admins and moderators', async function () {
      for (const token of [ userToken, moderatorToken, servers[0].accessToken ]) {
        await servers[0].comments.createThread({ videoId, text: 'right', token })
      }

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.comments.listThreads({ videoId, sort: '-createdAt' })
        expect(data.filter(c => c.text === 'right')).to.have.lengthOf(3)
      }
    })
  })

  describe('On video with comments with some tags requiring approval', function () {
    let videoId: string

    before(async function () {
      this.timeout(30000)

      videoId = await createVideo(VideoCommentPolicy.ENABLED)
    })

    it('Should only have built-in auto tag policies and no policies set', async function () {
      const { review } = await servers[0].autoTags.getCommentPolicies({ accountName: 'user1', token: userToken })
      expect(review).to.have.lengthOf(0)

      const { available } = await servers[0].autoTags.getAccountAvailable({ accountName: 'user1', token: userToken })
      expect(available.map(a => a.name)).to.deep.equal([ 'external-link' ])
    })

    it('Should add watched words and so available tag policies', async function () {
      await servers[0].watchedWordsLists.createList({
        token: userToken,
        listName: 'forbidden-list',
        words: [ 'forbidden' ],
        accountName: 'user1'
      })

      await servers[0].watchedWordsLists.createList({
        token: userToken,
        listName: 'allowed-list',
        words: [ 'allowed' ],
        accountName: 'user1'
      })

      const { review } = await servers[0].autoTags.getCommentPolicies({ accountName: 'user1', token: userToken })
      expect(review).to.have.lengthOf(0)

      const { available } = await servers[0].autoTags.getAccountAvailable({ accountName: 'user1', token: userToken })
      expect(available.map(a => a.name)).to.have.deep.members([ 'external-link', 'forbidden-list', 'allowed-list' ])
    })

    it('Should update policies', async function () {
      await servers[0].autoTags.updateCommentPolicies({
        accountName: 'user1',
        review: [ 'external-link', 'forbidden-list' ],
        token: userToken
      })

      const { review } = await servers[0].autoTags.getCommentPolicies({ accountName: 'user1', token: userToken })
      expect(review).to.have.deep.members([ 'external-link', 'forbidden-list' ])
    })

    it('Should publish a comment without approval', async function () {
      const threadText = '1 - framasoft and allowed'
      const replyText = '1 - frama and allowed'

      await servers[0].comments.createThread({ token: anotherUserToken, videoId, text: threadText })
      await waitJobs(servers)

      const commentId = await servers[1].comments.findCommentId({ videoId, text: threadText })
      await servers[1].comments.addReply({ text: replyText, videoId, toCommentId: commentId })

      await waitJobs(servers)

      const { data } = await servers[0].comments.listCommentsOnMyVideos({ token: userToken })
      const t = data.find(c => c.text === threadText)
      const r = data.find(c => c.text === replyText)

      expect(t.automaticTags).to.have.members([ 'allowed-list' ])
      expect(t.heldForReview).to.be.false

      expect(r.automaticTags).to.have.members([ 'allowed-list' ])
      expect(r.heldForReview).to.be.false
    })

    it('Should publish a comment with approval', async function () {
      const threadText = '2 - framasoft.org and allowed'
      const replyText = '2 - https://framasoft.org and forbidden'

      await servers[1].comments.createThread({ videoId, text: threadText })
      await waitJobs(servers)

      const commentId = await servers[0].comments.findCommentId({ videoId, text: threadText })
      await servers[0].comments.addReply({ token: anotherUserToken, text: replyText, videoId, toCommentId: commentId })

      await waitJobs(servers)

      const { data } = await servers[0].comments.listCommentsOnMyVideos({ token: userToken })
      const t = data.find(c => c.text === threadText)
      const r = data.find(c => c.text === replyText)

      expect(t.automaticTags).to.have.members([ 'external-link', 'allowed-list' ])
      expect(t.heldForReview).to.be.true

      expect(r.automaticTags).to.have.members([ 'external-link', 'forbidden-list' ])
      expect(r.heldForReview).to.be.true
    })

    it('Should update policies and not update previously tags set', async function () {
      await servers[0].autoTags.updateCommentPolicies({ accountName: 'user1', review: [ 'forbidden-list' ], token: userToken })

      const { review } = await servers[0].autoTags.getCommentPolicies({ accountName: 'user1', token: userToken })
      expect(review).to.have.deep.members([ 'forbidden-list' ])

      const { available } = await servers[0].autoTags.getAccountAvailable({ accountName: 'user1', token: userToken })
      expect(available.map(a => a.name)).to.have.deep.members([ 'external-link', 'forbidden-list', 'allowed-list' ])

      const { data } = await servers[0].comments.listCommentsOnMyVideos({ videoId, token: userToken })
      expect(data.filter(c => c.heldForReview)).to.have.lengthOf(2)
    })

    it('Should publish a comment with and without approval base on the new policies', async function () {
      const threadText = '3 - framasoft.org and allowed'
      const replyText = '3 - forbidden'

      await servers[0].comments.createThread({ token: anotherUserToken, videoId, text: threadText })
      await servers[0].comments.addReplyToLastThread({ token: anotherUserToken, text: replyText })
      await waitJobs(servers)

      const { data } = await servers[0].comments.listCommentsOnMyVideos({ token: userToken })
      const t = data.find(c => c.text === threadText)
      const r = data.find(c => c.text === replyText)

      expect(t.automaticTags).to.have.members([ 'external-link', 'allowed-list' ])
      expect(t.heldForReview).to.be.false

      expect(r.automaticTags).to.have.members([ 'forbidden-list' ])
      expect(r.heldForReview).to.be.true
    })

    it('Should not require approval for a moderator but it should have the tag set', async function () {
      await servers[0].comments.createThread({ token: moderatorToken, videoId, text: 'forbidden' })
      await waitJobs(servers)

      const { data } = await servers[0].comments.listCommentsOnMyVideos({ token: userToken })
      const t = data.find(c => c.text === 'forbidden')

      expect(t.automaticTags).to.have.members([ 'forbidden-list' ])
      expect(t.heldForReview).to.be.false
    })

    it('Should not have threads waiting for approval before approbation for anonymous users on server 1 and 3', async function () {
      for (const server of [ servers[0], servers[2] ]) {
        const { data } = await server.comments.listThreads({ videoId })
        expect(data).to.have.lengthOf(3)

        expect(data.some(c => c.text === '2 - framasoft.org and allowed')).to.be.false
      }
    })

    it('Should see threads waiting for approval before approbation for anonymous users on server 2', async function () {
      const { data } = await servers[1].comments.listThreads({ videoId })
      expect(data).to.have.lengthOf(4)

      expect(data.some(c => c.text === '2 - framasoft.org and allowed')).to.be.true
      expect(data.some(c => c.text === '2 - https://framasoft.org and forbidden')).to.be.false
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
