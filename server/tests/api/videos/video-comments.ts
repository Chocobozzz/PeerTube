/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import { VideoComment, VideoCommentThreadTree } from '../../../../shared/models/videos/video-comment.model'
import { cleanupTests, testImage } from '../../../../shared/extra-utils'
import {
  createUser,
  dateIsValid,
  flushAndRunServer,
  getAccessToken,
  ServerInfo,
  setAccessTokensToServers,
  updateMyAvatar,
  uploadVideo
} from '../../../../shared/extra-utils/index'
import {
  addVideoCommentReply,
  addVideoCommentThread,
  deleteVideoComment,
  getVideoCommentThreads,
  getVideoThreadComments
} from '../../../../shared/extra-utils/videos/video-comments'

const expect = chai.expect

describe('Test video comments', function () {
  let server: ServerInfo
  let videoId
  let videoUUID
  let threadId
  let replyToDeleteId: number

  let userAccessTokenServer1: string

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    const res = await uploadVideo(server.url, server.accessToken, {})
    videoUUID = res.body.video.uuid
    videoId = res.body.video.id

    await updateMyAvatar({
      url: server.url,
      accessToken: server.accessToken,
      fixture: 'avatar.png'
    })

    await createUser({
      url: server.url,
      accessToken: server.accessToken,
      username: 'user1',
      password: 'password'
    })
    userAccessTokenServer1 = await getAccessToken(server.url, 'user1', 'password')
  })

  it('Should not have threads on this video', async function () {
    const res = await getVideoCommentThreads(server.url, videoUUID, 0, 5)

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(0)
  })

  it('Should create a thread in this video', async function () {
    const text = 'my super first comment'

    const res = await addVideoCommentThread(server.url, server.accessToken, videoUUID, text)
    const comment = res.body.comment

    expect(comment.inReplyToCommentId).to.be.null
    expect(comment.text).equal('my super first comment')
    expect(comment.videoId).to.equal(videoId)
    expect(comment.id).to.equal(comment.threadId)
    expect(comment.account.name).to.equal('root')
    expect(comment.account.host).to.equal('localhost:' + server.port)
    expect(comment.account.url).to.equal('http://localhost:' + server.port + '/accounts/root')
    expect(comment.totalReplies).to.equal(0)
    expect(comment.totalRepliesFromVideoAuthor).to.equal(0)
    expect(dateIsValid(comment.createdAt as string)).to.be.true
    expect(dateIsValid(comment.updatedAt as string)).to.be.true
  })

  it('Should list threads of this video', async function () {
    const res = await getVideoCommentThreads(server.url, videoUUID, 0, 5)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(1)

    const comment: VideoComment = res.body.data[0]
    expect(comment.inReplyToCommentId).to.be.null
    expect(comment.text).equal('my super first comment')
    expect(comment.videoId).to.equal(videoId)
    expect(comment.id).to.equal(comment.threadId)
    expect(comment.account.name).to.equal('root')
    expect(comment.account.host).to.equal('localhost:' + server.port)

    await testImage(server.url, 'avatar-resized', comment.account.avatar.path, '.png')

    expect(comment.totalReplies).to.equal(0)
    expect(comment.totalRepliesFromVideoAuthor).to.equal(0)
    expect(dateIsValid(comment.createdAt as string)).to.be.true
    expect(dateIsValid(comment.updatedAt as string)).to.be.true

    threadId = comment.threadId
  })

  it('Should get all the thread created', async function () {
    const res = await getVideoThreadComments(server.url, videoUUID, threadId)

    const rootComment = res.body.comment
    expect(rootComment.inReplyToCommentId).to.be.null
    expect(rootComment.text).equal('my super first comment')
    expect(rootComment.videoId).to.equal(videoId)
    expect(dateIsValid(rootComment.createdAt as string)).to.be.true
    expect(dateIsValid(rootComment.updatedAt as string)).to.be.true
  })

  it('Should create multiple replies in this thread', async function () {
    const text1 = 'my super answer to thread 1'
    const childCommentRes = await addVideoCommentReply(server.url, server.accessToken, videoId, threadId, text1)
    const childCommentId = childCommentRes.body.comment.id

    const text2 = 'my super answer to answer of thread 1'
    await addVideoCommentReply(server.url, server.accessToken, videoId, childCommentId, text2)

    const text3 = 'my second answer to thread 1'
    await addVideoCommentReply(server.url, server.accessToken, videoId, threadId, text3)
  })

  it('Should get correctly the replies', async function () {
    const res = await getVideoThreadComments(server.url, videoUUID, threadId)

    const tree: VideoCommentThreadTree = res.body
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

    replyToDeleteId = secondChild.comment.id
  })

  it('Should create other threads', async function () {
    const text1 = 'super thread 2'
    await addVideoCommentThread(server.url, server.accessToken, videoUUID, text1)

    const text2 = 'super thread 3'
    await addVideoCommentThread(server.url, server.accessToken, videoUUID, text2)
  })

  it('Should list the threads', async function () {
    const res = await getVideoCommentThreads(server.url, videoUUID, 0, 5, 'createdAt')

    expect(res.body.total).to.equal(3)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(3)

    expect(res.body.data[0].text).to.equal('my super first comment')
    expect(res.body.data[0].totalReplies).to.equal(3)
    expect(res.body.data[1].text).to.equal('super thread 2')
    expect(res.body.data[1].totalReplies).to.equal(0)
    expect(res.body.data[2].text).to.equal('super thread 3')
    expect(res.body.data[2].totalReplies).to.equal(0)
  })

  it('Should delete a reply', async function () {
    await deleteVideoComment(server.url, server.accessToken, videoId, replyToDeleteId)

    const res = await getVideoThreadComments(server.url, videoUUID, threadId)

    const tree: VideoCommentThreadTree = res.body
    expect(tree.comment.text).equal('my super first comment')
    expect(tree.children).to.have.lengthOf(2)

    const firstChild = tree.children[0]
    expect(firstChild.comment.text).to.equal('my super answer to thread 1')
    expect(firstChild.children).to.have.lengthOf(1)

    const childOfFirstChild = firstChild.children[0]
    expect(childOfFirstChild.comment.text).to.equal('my super answer to answer of thread 1')
    expect(childOfFirstChild.children).to.have.lengthOf(0)

    const deletedChildOfFirstChild = tree.children[1]
    expect(deletedChildOfFirstChild.comment.text).to.equal('')
    expect(deletedChildOfFirstChild.comment.isDeleted).to.be.true
    expect(deletedChildOfFirstChild.comment.deletedAt).to.not.be.null
    expect(deletedChildOfFirstChild.comment.account).to.be.null
    expect(deletedChildOfFirstChild.children).to.have.lengthOf(0)
  })

  it('Should delete a complete thread', async function () {
    await deleteVideoComment(server.url, server.accessToken, videoId, threadId)

    const res = await getVideoCommentThreads(server.url, videoUUID, 0, 5, 'createdAt')
    expect(res.body.total).to.equal(3)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(3)

    expect(res.body.data[0].text).to.equal('')
    expect(res.body.data[0].isDeleted).to.be.true
    expect(res.body.data[0].deletedAt).to.not.be.null
    expect(res.body.data[0].account).to.be.null
    expect(res.body.data[0].totalReplies).to.equal(3)
    expect(res.body.data[1].text).to.equal('super thread 2')
    expect(res.body.data[1].totalReplies).to.equal(0)
    expect(res.body.data[2].text).to.equal('super thread 3')
    expect(res.body.data[2].totalReplies).to.equal(0)
  })

  it('Should count replies from the video author correctly', async function () {
    const text = 'my super first comment'
    await addVideoCommentThread(server.url, server.accessToken, videoUUID, text)
    let res = await getVideoCommentThreads(server.url, videoUUID, 0, 5)
    const comment: VideoComment = res.body.data[0]
    const threadId2 = comment.threadId

    const text2 = 'a first answer to thread 4 by a third party'
    await addVideoCommentReply(server.url, userAccessTokenServer1, videoId, threadId2, text2)

    const text3 = 'my second answer to thread 4'
    await addVideoCommentReply(server.url, server.accessToken, videoId, threadId2, text3)

    res = await getVideoThreadComments(server.url, videoUUID, threadId2)
    const tree: VideoCommentThreadTree = res.body
    expect(tree.comment.totalReplies).to.equal(tree.comment.totalRepliesFromVideoAuthor + 1)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
