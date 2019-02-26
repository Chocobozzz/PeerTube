/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { join } from 'path'
import * as request from 'supertest'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { VideoComment, VideoCommentThreadTree } from '../../../../shared/models/videos/video-comment.model'
import {
  addVideoChannel,
  checkTmpIsEmpty,
  checkVideoFilesWereRemoved,
  completeVideoCheck,
  createUser,
  dateIsValid,
  doubleFollow,
  flushAndRunMultipleServers,
  flushTests,
  getLocalVideos,
  getVideo,
  getVideoChannelsList,
  getVideosList,
  killallServers,
  rateVideo,
  removeVideo,
  ServerInfo,
  setAccessTokensToServers,
  testImage,
  updateVideo,
  uploadVideo,
  userLogin,
  viewVideo,
  wait,
  webtorrentAdd
} from '../../../../shared/utils'
import {
  addVideoCommentReply,
  addVideoCommentThread,
  deleteVideoComment,
  getVideoCommentThreads,
  getVideoThreadComments
} from '../../../../shared/utils/videos/video-comments'
import { waitJobs } from '../../../../shared/utils/server/jobs'

const expect = chai.expect

describe('Test video playlists', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
    // Server 1 and server 3 follow each other
    await doubleFollow(servers[0], servers[2])
  })

  it('Should create a playlist on server 1 and have the playlist on server 2 and 3', async function () {

  })

  it('Should create a playlist on server 2 and have the playlist on server 1 but not on server 3', async function () {
    // create 2 playlists (with videos and no videos)
    // With thumbnail and no thumbnail
  })

  it('Should have the playlist on server 3 after a new follow', async function () {
    // Server 2 and server 3 follow each other
    await doubleFollow(servers[1], servers[2])
  })

  it('Should create some playlists and list them correctly', async function () {
    // create 3 playlists with some videos in it
    // check pagination
    // check sort
    // check empty
  })

  it('Should list video channel playlists', async function () {
    // check pagination
    // check sort
    // check empty
  })

  it('Should list account playlists', async function () {
    // check pagination
    // check sort
    // check empty
  })

  it('Should get a playlist', async function () {
    // get empty playlist
    // get non empty playlist
  })

  it('Should update a playlist', async function () {
    // update thumbnail

    // update other details
  })

  it('Should create a playlist containing different startTimestamp/endTimestamp videos', async function () {

  })

  it('Should correctly list playlist videos', async function () {
    // empty
    // some filters?
  })

  it('Should reorder the playlist', async function () {
    // reorder 1 element
    // reorder 3 elements
    // reorder at the beginning
    // reorder at the end
    // reorder before/after
  })

  it('Should update startTimestamp/endTimestamp of some elements', async function () {

  })

  it('Should delete some elements', async function () {

  })

  it('Should delete the playlist on server 1 and delete on server 2 and 3', async function () {

  })

  it('Should have deleted the thumbnail on server 1, 2 and 3', async function () {

  })

  it('Should unfollow servers 1 and 2 and hide their playlists', async function () {

  })

  it('Should delete a channel and remove the associated playlist', async function () {

  })

  it('Should delete an account and delete its playlists', async function () {

  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
