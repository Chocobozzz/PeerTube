/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { AbusePredefinedReasonsString, AbuseState, AdminAbuse } from '@shared/models'
import {
  cleanupTests,
  createUser,
  deleteVideoAbuse,
  flushAndRunMultipleServers,
  getVideoAbusesList,
  getVideosList,
  removeVideo,
  reportVideoAbuse,
  ServerInfo,
  setAccessTokensToServers,
  updateVideoAbuse,
  uploadVideo,
  userLogin
} from '../../../../shared/extra-utils/index'
import { doubleFollow } from '../../../../shared/extra-utils/server/follows'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import {
  addAccountToServerBlocklist,
  addServerToServerBlocklist,
  removeAccountFromServerBlocklist,
  removeServerFromServerBlocklist
} from '../../../../shared/extra-utils/users/blocklist'

const expect = chai.expect

// FIXME: deprecated in 2.3. Remove this controller

describe('Test video abuses', function () {
  let servers: ServerInfo[] = []
  let abuseServer2: AdminAbuse

  before(async function () {
    this.timeout(50000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    // Upload some videos on each servers
    const video1Attributes = {
      name: 'my super name for server 1',
      description: 'my super description for server 1'
    }
    await uploadVideo(servers[0].url, servers[0].accessToken, video1Attributes)

    const video2Attributes = {
      name: 'my super name for server 2',
      description: 'my super description for server 2'
    }
    await uploadVideo(servers[1].url, servers[1].accessToken, video2Attributes)

    // Wait videos propagation, server 2 has transcoding enabled
    await waitJobs(servers)

    const res = await getVideosList(servers[0].url)
    const videos = res.body.data

    expect(videos.length).to.equal(2)

    servers[0].video = videos.find(video => video.name === 'my super name for server 1')
    servers[1].video = videos.find(video => video.name === 'my super name for server 2')
  })

  it('Should not have video abuses', async function () {
    const res = await getVideoAbusesList({ url: servers[0].url, token: servers[0].accessToken })

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data.length).to.equal(0)
  })

  it('Should report abuse on a local video', async function () {
    this.timeout(15000)

    const reason = 'my super bad reason'
    await reportVideoAbuse(servers[0].url, servers[0].accessToken, servers[0].video.id, reason)

    // We wait requests propagation, even if the server 1 is not supposed to make a request to server 2
    await waitJobs(servers)
  })

  it('Should have 1 video abuses on server 1 and 0 on server 2', async function () {
    const res1 = await getVideoAbusesList({ url: servers[0].url, token: servers[0].accessToken })

    expect(res1.body.total).to.equal(1)
    expect(res1.body.data).to.be.an('array')
    expect(res1.body.data.length).to.equal(1)

    const abuse: AdminAbuse = res1.body.data[0]
    expect(abuse.reason).to.equal('my super bad reason')
    expect(abuse.reporterAccount.name).to.equal('root')
    expect(abuse.reporterAccount.host).to.equal('localhost:' + servers[0].port)
    expect(abuse.video.id).to.equal(servers[0].video.id)
    expect(abuse.video.channel).to.exist
    expect(abuse.video.countReports).to.equal(1)
    expect(abuse.video.nthReport).to.equal(1)
    expect(abuse.countReportsForReporter).to.equal(1)
    expect(abuse.countReportsForReportee).to.equal(1)

    const res2 = await getVideoAbusesList({ url: servers[1].url, token: servers[1].accessToken })
    expect(res2.body.total).to.equal(0)
    expect(res2.body.data).to.be.an('array')
    expect(res2.body.data.length).to.equal(0)
  })

  it('Should report abuse on a remote video', async function () {
    this.timeout(10000)

    const reason = 'my super bad reason 2'
    await reportVideoAbuse(servers[0].url, servers[0].accessToken, servers[1].video.id, reason)

    // We wait requests propagation
    await waitJobs(servers)
  })

  it('Should have 2 video abuses on server 1 and 1 on server 2', async function () {
    const res1 = await getVideoAbusesList({ url: servers[0].url, token: servers[0].accessToken })
    expect(res1.body.total).to.equal(2)
    expect(res1.body.data).to.be.an('array')
    expect(res1.body.data.length).to.equal(2)

    const abuse1: AdminAbuse = res1.body.data[0]
    expect(abuse1.reason).to.equal('my super bad reason')
    expect(abuse1.reporterAccount.name).to.equal('root')
    expect(abuse1.reporterAccount.host).to.equal('localhost:' + servers[0].port)
    expect(abuse1.video.id).to.equal(servers[0].video.id)
    expect(abuse1.state.id).to.equal(AbuseState.PENDING)
    expect(abuse1.state.label).to.equal('Pending')
    expect(abuse1.moderationComment).to.be.null
    expect(abuse1.video.countReports).to.equal(1)
    expect(abuse1.video.nthReport).to.equal(1)

    const abuse2: AdminAbuse = res1.body.data[1]
    expect(abuse2.reason).to.equal('my super bad reason 2')
    expect(abuse2.reporterAccount.name).to.equal('root')
    expect(abuse2.reporterAccount.host).to.equal('localhost:' + servers[0].port)
    expect(abuse2.video.id).to.equal(servers[1].video.id)
    expect(abuse2.state.id).to.equal(AbuseState.PENDING)
    expect(abuse2.state.label).to.equal('Pending')
    expect(abuse2.moderationComment).to.be.null

    const res2 = await getVideoAbusesList({ url: servers[1].url, token: servers[1].accessToken })
    expect(res2.body.total).to.equal(1)
    expect(res2.body.data).to.be.an('array')
    expect(res2.body.data.length).to.equal(1)

    abuseServer2 = res2.body.data[0]
    expect(abuseServer2.reason).to.equal('my super bad reason 2')
    expect(abuseServer2.reporterAccount.name).to.equal('root')
    expect(abuseServer2.reporterAccount.host).to.equal('localhost:' + servers[0].port)
    expect(abuseServer2.state.id).to.equal(AbuseState.PENDING)
    expect(abuseServer2.state.label).to.equal('Pending')
    expect(abuseServer2.moderationComment).to.be.null
  })

  it('Should update the state of a video abuse', async function () {
    const body = { state: AbuseState.REJECTED }
    await updateVideoAbuse(servers[1].url, servers[1].accessToken, abuseServer2.video.uuid, abuseServer2.id, body)

    const res = await getVideoAbusesList({ url: servers[1].url, token: servers[1].accessToken })
    expect(res.body.data[0].state.id).to.equal(AbuseState.REJECTED)
  })

  it('Should add a moderation comment', async function () {
    const body = { state: AbuseState.ACCEPTED, moderationComment: 'It is valid' }
    await updateVideoAbuse(servers[1].url, servers[1].accessToken, abuseServer2.video.uuid, abuseServer2.id, body)

    const res = await getVideoAbusesList({ url: servers[1].url, token: servers[1].accessToken })
    expect(res.body.data[0].state.id).to.equal(AbuseState.ACCEPTED)
    expect(res.body.data[0].moderationComment).to.equal('It is valid')
  })

  it('Should hide video abuses from blocked accounts', async function () {
    this.timeout(10000)

    {
      await reportVideoAbuse(servers[1].url, servers[1].accessToken, servers[0].video.uuid, 'will mute this')
      await waitJobs(servers)

      const res = await getVideoAbusesList({ url: servers[0].url, token: servers[0].accessToken })
      expect(res.body.total).to.equal(3)
    }

    const accountToBlock = 'root@localhost:' + servers[1].port

    {
      await addAccountToServerBlocklist(servers[0].url, servers[0].accessToken, accountToBlock)

      const res = await getVideoAbusesList({ url: servers[0].url, token: servers[0].accessToken })
      expect(res.body.total).to.equal(2)

      const abuse = res.body.data.find(a => a.reason === 'will mute this')
      expect(abuse).to.be.undefined
    }

    {
      await removeAccountFromServerBlocklist(servers[0].url, servers[0].accessToken, accountToBlock)

      const res = await getVideoAbusesList({ url: servers[0].url, token: servers[0].accessToken })
      expect(res.body.total).to.equal(3)
    }
  })

  it('Should hide video abuses from blocked servers', async function () {
    const serverToBlock = servers[1].host

    {
      await addServerToServerBlocklist(servers[0].url, servers[0].accessToken, servers[1].host)

      const res = await getVideoAbusesList({ url: servers[0].url, token: servers[0].accessToken })
      expect(res.body.total).to.equal(2)

      const abuse = res.body.data.find(a => a.reason === 'will mute this')
      expect(abuse).to.be.undefined
    }

    {
      await removeServerFromServerBlocklist(servers[0].url, servers[0].accessToken, serverToBlock)

      const res = await getVideoAbusesList({ url: servers[0].url, token: servers[0].accessToken })
      expect(res.body.total).to.equal(3)
    }
  })

  it('Should keep the video abuse when deleting the video', async function () {
    this.timeout(10000)

    await removeVideo(servers[1].url, servers[1].accessToken, abuseServer2.video.uuid)

    await waitJobs(servers)

    const res = await getVideoAbusesList({ url: servers[1].url, token: servers[1].accessToken })
    expect(res.body.total).to.equal(2, "wrong number of videos returned")
    expect(res.body.data.length).to.equal(2, "wrong number of videos returned")
    expect(res.body.data[0].id).to.equal(abuseServer2.id, "wrong origin server id for first video")

    const abuse: AdminAbuse = res.body.data[0]
    expect(abuse.video.id).to.equal(abuseServer2.video.id, "wrong video id")
    expect(abuse.video.channel).to.exist
    expect(abuse.video.deleted).to.be.true
  })

  it('Should include counts of reports from reporter and reportee', async function () {
    this.timeout(10000)

    // register a second user to have two reporters/reportees
    const user = { username: 'user2', password: 'password' }
    await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, ...user })
    const userAccessToken = await userLogin(servers[0], user)

    // upload a third video via this user
    const video3Attributes = {
      name: 'my second super name for server 1',
      description: 'my second super description for server 1'
    }
    await uploadVideo(servers[0].url, userAccessToken, video3Attributes)

    const res1 = await getVideosList(servers[0].url)
    const videos = res1.body.data
    const video3 = videos.find(video => video.name === 'my second super name for server 1')

    // resume with the test
    const reason3 = 'my super bad reason 3'
    await reportVideoAbuse(servers[0].url, servers[0].accessToken, video3.id, reason3)
    const reason4 = 'my super bad reason 4'
    await reportVideoAbuse(servers[0].url, userAccessToken, servers[0].video.id, reason4)

    const res2 = await getVideoAbusesList({ url: servers[0].url, token: servers[0].accessToken })

    {
      for (const abuse of res2.body.data as AdminAbuse[]) {
        if (abuse.video.id === video3.id) {
          expect(abuse.video.countReports).to.equal(1, "wrong reports count for video 3")
          expect(abuse.video.nthReport).to.equal(1, "wrong report position in report list for video 3")
          expect(abuse.countReportsForReportee).to.equal(1, "wrong reports count for reporter on video 3 abuse")
          expect(abuse.countReportsForReporter).to.equal(3, "wrong reports count for reportee on video 3 abuse")
        }
        if (abuse.video.id === servers[0].video.id) {
          expect(abuse.countReportsForReportee).to.equal(3, "wrong reports count for reporter on video 1 abuse")
        }
      }
    }
  })

  it('Should list predefined reasons as well as timestamps for the reported video', async function () {
    this.timeout(10000)

    const reason5 = 'my super bad reason 5'
    const predefinedReasons5: AbusePredefinedReasonsString[] = [ 'violentOrRepulsive', 'captions' ]
    const createdAbuse = (await reportVideoAbuse(
      servers[0].url,
      servers[0].accessToken,
      servers[0].video.id,
      reason5,
      predefinedReasons5,
      1,
      5
    )).body.abuse

    const res = await getVideoAbusesList({ url: servers[0].url, token: servers[0].accessToken })

    {
      const abuse = (res.body.data as AdminAbuse[]).find(a => a.id === createdAbuse.id)
      expect(abuse.reason).to.equals(reason5)
      expect(abuse.predefinedReasons).to.deep.equals(predefinedReasons5, "predefined reasons do not match the one reported")
      expect(abuse.video.startAt).to.equal(1, "starting timestamp doesn't match the one reported")
      expect(abuse.video.endAt).to.equal(5, "ending timestamp doesn't match the one reported")
    }
  })

  it('Should delete the video abuse', async function () {
    this.timeout(10000)

    await deleteVideoAbuse(servers[1].url, servers[1].accessToken, abuseServer2.video.uuid, abuseServer2.id)

    await waitJobs(servers)

    {
      const res = await getVideoAbusesList({ url: servers[1].url, token: servers[1].accessToken })
      expect(res.body.total).to.equal(1)
      expect(res.body.data.length).to.equal(1)
      expect(res.body.data[0].id).to.not.equal(abuseServer2.id)
    }

    {
      const res = await getVideoAbusesList({ url: servers[0].url, token: servers[0].accessToken })
      expect(res.body.total).to.equal(6)
    }
  })

  it('Should list and filter video abuses', async function () {
    async function list (query: Omit<Parameters<typeof getVideoAbusesList>[0], 'url' | 'token'>) {
      const options = {
        url: servers[0].url,
        token: servers[0].accessToken
      }

      Object.assign(options, query)

      const res = await getVideoAbusesList(options)

      return res.body.data as AdminAbuse[]
    }

    expect(await list({ id: 56 })).to.have.lengthOf(0)
    expect(await list({ id: 1 })).to.have.lengthOf(1)

    expect(await list({ search: 'my super name for server 1' })).to.have.lengthOf(4)
    expect(await list({ search: 'aaaaaaaaaaaaaaaaaaaaaaaaaa' })).to.have.lengthOf(0)

    expect(await list({ searchVideo: 'my second super name for server 1' })).to.have.lengthOf(1)

    expect(await list({ searchVideoChannel: 'root' })).to.have.lengthOf(4)
    expect(await list({ searchVideoChannel: 'aaaa' })).to.have.lengthOf(0)

    expect(await list({ searchReporter: 'user2' })).to.have.lengthOf(1)
    expect(await list({ searchReporter: 'root' })).to.have.lengthOf(5)

    expect(await list({ searchReportee: 'root' })).to.have.lengthOf(5)
    expect(await list({ searchReportee: 'aaaa' })).to.have.lengthOf(0)

    expect(await list({ videoIs: 'deleted' })).to.have.lengthOf(1)
    expect(await list({ videoIs: 'blacklisted' })).to.have.lengthOf(0)

    expect(await list({ state: AbuseState.ACCEPTED })).to.have.lengthOf(0)
    expect(await list({ state: AbuseState.PENDING })).to.have.lengthOf(6)

    expect(await list({ predefinedReason: 'violentOrRepulsive' })).to.have.lengthOf(1)
    expect(await list({ predefinedReason: 'serverRules' })).to.have.lengthOf(0)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
