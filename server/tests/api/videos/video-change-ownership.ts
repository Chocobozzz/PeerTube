/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  acceptChangeOwnership,
  changeVideoOwnership,
  createUser,
  flushTests,
  getMyUserInformation,
  getVideoChangeOwnershipList,
  getVideosList,
  killallServers,
  refuseChangeOwnership,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  userLogin
} from '../../utils'
import { waitJobs } from '../../utils/server/jobs'
import { User } from '../../../../shared/models/users'

const expect = chai.expect

describe('Test video change ownership', function () {
  let server: ServerInfo = undefined
  const firstUser = {
    username: 'first',
    password: 'My great password'
  }
  const secondUser = {
    username: 'second',
    password: 'My other password'
  }
  let firstUserAccessToken = ''
  let secondUserAccessToken = ''
  let lastRequestChangeOwnershipId = undefined

  before(async function () {
    this.timeout(50000)

    // Run one server
    await flushTests()
    server = await runServer(1)
    await setAccessTokensToServers([server])

    const videoQuota = 42000000
    await createUser(server.url, server.accessToken, firstUser.username, firstUser.password, videoQuota)
    await createUser(server.url, server.accessToken, secondUser.username, secondUser.password, videoQuota)

    firstUserAccessToken = await userLogin(server, firstUser)
    secondUserAccessToken = await userLogin(server, secondUser)

    // Upload some videos on the server
    const video1Attributes = {
      name: 'my super name',
      description: 'my super description'
    }
    await uploadVideo(server.url, firstUserAccessToken, video1Attributes)

    await waitJobs(server)

    const res = await getVideosList(server.url)
    const videos = res.body.data

    expect(videos.length).to.equal(1)

    server.video = videos.find(video => video.name === 'my super name')
  })

  it('Should not have video change ownership', async function () {
    const resFirstUser = await getVideoChangeOwnershipList(server.url, firstUserAccessToken)

    expect(resFirstUser.body.total).to.equal(0)
    expect(resFirstUser.body.data).to.be.an('array')
    expect(resFirstUser.body.data.length).to.equal(0)

    const resSecondUser = await getVideoChangeOwnershipList(server.url, secondUserAccessToken)

    expect(resSecondUser.body.total).to.equal(0)
    expect(resSecondUser.body.data).to.be.an('array')
    expect(resSecondUser.body.data.length).to.equal(0)
  })

  it('Should send a request to change ownership of a video', async function () {
    this.timeout(15000)

    await changeVideoOwnership(server.url, firstUserAccessToken, server.video.id, secondUser.username)
  })

  it('Should only return a request to change ownership for the second user', async function () {
    const resFirstUser = await getVideoChangeOwnershipList(server.url, firstUserAccessToken)

    expect(resFirstUser.body.total).to.equal(0)
    expect(resFirstUser.body.data).to.be.an('array')
    expect(resFirstUser.body.data.length).to.equal(0)

    const resSecondUser = await getVideoChangeOwnershipList(server.url, secondUserAccessToken)

    expect(resSecondUser.body.total).to.equal(1)
    expect(resSecondUser.body.data).to.be.an('array')
    expect(resSecondUser.body.data.length).to.equal(1)

    lastRequestChangeOwnershipId = resSecondUser.body.data[0].id
  })

  it('Should accept the same change ownership request without crashing', async function () {
    this.timeout(10000)

    await changeVideoOwnership(server.url, firstUserAccessToken, server.video.id, secondUser.username)
  })

  it('Should not create multiple change ownership requests while one is waiting', async function () {
    this.timeout(10000)

    const resSecondUser = await getVideoChangeOwnershipList(server.url, secondUserAccessToken)

    expect(resSecondUser.body.total).to.equal(1)
    expect(resSecondUser.body.data).to.be.an('array')
    expect(resSecondUser.body.data.length).to.equal(1)
  })

  it('Should not be possible to refuse the change of ownership from first user', async function () {
    this.timeout(10000)

    await refuseChangeOwnership(server.url, firstUserAccessToken, lastRequestChangeOwnershipId, 403)
  })

  it('Should be possible to refuse the change of ownership from second user', async function () {
    this.timeout(10000)

    await refuseChangeOwnership(server.url, secondUserAccessToken, lastRequestChangeOwnershipId)
  })

  it('Should send a new request to change ownership of a video', async function () {
    this.timeout(15000)

    await changeVideoOwnership(server.url, firstUserAccessToken, server.video.id, secondUser.username)
  })

  it('Should return two requests to change ownership for the second user', async function () {
    const resFirstUser = await getVideoChangeOwnershipList(server.url, firstUserAccessToken)

    expect(resFirstUser.body.total).to.equal(0)
    expect(resFirstUser.body.data).to.be.an('array')
    expect(resFirstUser.body.data.length).to.equal(0)

    const resSecondUser = await getVideoChangeOwnershipList(server.url, secondUserAccessToken)

    expect(resSecondUser.body.total).to.equal(2)
    expect(resSecondUser.body.data).to.be.an('array')
    expect(resSecondUser.body.data.length).to.equal(2)

    lastRequestChangeOwnershipId = resSecondUser.body.data[0].id
  })

  it('Should not be possible to accept the change of ownership from first user', async function () {
    this.timeout(10000)

    const secondUserInformationResponse = await getMyUserInformation(server.url, secondUserAccessToken)
    const secondUserInformation: User = secondUserInformationResponse.body
    const channelId = secondUserInformation.videoChannels[0].id
    await acceptChangeOwnership(server.url, firstUserAccessToken, lastRequestChangeOwnershipId, channelId, 403)
  })

  it('Should be possible to accept the change of ownership from second user', async function () {
    this.timeout(10000)

    const secondUserInformationResponse = await getMyUserInformation(server.url, secondUserAccessToken)
    const secondUserInformation: User = secondUserInformationResponse.body
    const channelId = secondUserInformation.videoChannels[0].id
    await acceptChangeOwnership(server.url, secondUserAccessToken, lastRequestChangeOwnershipId, channelId)
  })

  after(async function () {
    killallServers([server])
  })
})
