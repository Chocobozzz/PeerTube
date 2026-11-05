/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-deprecated */

import { wait } from '@peertube/peertube-core-utils'
import { AuditLog, HttpStatusCode, HttpStatusCodeType, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  killallServers,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test audit logs', function () {
  let server: PeerTubeServer
  let rootId: number

  async function getAuditLogsArray (options: { startDate: Date, expectedStatus?: HttpStatusCodeType }) {
    const { startDate, expectedStatus = HttpStatusCode.OK_200 } = options

    const res = await makeGetRequest({
      url: server.url,
      path: '/api/v1/server/audit-logs',
      token: server.accessToken,
      query: { startDate: startDate.toISOString() },
      expectedStatus
    })

    return res.body as AuditLog[]
  }

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    rootId = (await server.users.getMyInfo()).id
  })

  describe('Recorded entries', function () {
    it('Should record a video creation, update and deletion', async function () {
      this.timeout(60000)

      const { id, uuid } = await server.videos.upload({
        attributes: { name: 'audited video', tags: [ 'tag1' ], privacy: VideoPrivacy.PUBLIC }
      })
      await waitJobs([ server ])

      await server.videos.update({
        id: uuid,
        attributes: { name: 'audited video updated', tags: [ 'tag1', 'tag2' ], privacy: VideoPrivacy.UNLISTED, category: 2 }
      })

      await server.videos.remove({ id: uuid })

      const logs = await server.logs.waitAuditLogs({ entityType: 'video', entityId: id, total: 3 })
      expect(logs.map(l => l.action)).to.deep.equal([ 'create', 'update', 'delete' ])

      for (const log of logs) {
        expect(log.entityType).to.equal('video')
        expect(log.entityId).to.equal(id)
        expect(log.user).to.deep.equal({ id: rootId, username: 'root' })
        expect(log.ip).to.be.a('string').and.to.include('127.0.0.1')
        expect(log.entity.uuid).to.equal(uuid)
        expect(log.entity.account.name).to.equal('root')
        expect(log.entity.channel.name).to.equal('root_channel')
        expect(new Date(log.createdAt).getTime()).to.be.above(0)
      }

      const [ create, update, remove ] = logs

      expect(create.changes).to.be.null
      expect(create.entity.name).to.equal('audited video')
      expect(create.entity.privacy).to.deep.equal({ id: VideoPrivacy.PUBLIC, label: 'Public' })
      expect(create.entity.tags).to.deep.equal([ 'tag1' ])

      expect(update.entity.name).to.equal('audited video updated')
      expect(update.changes['name']).to.deep.equal({ old: 'audited video', new: 'audited video updated' })
      expect(update.changes['privacy.id']).to.deep.equal({ old: VideoPrivacy.PUBLIC, new: VideoPrivacy.UNLISTED })
      expect(update.changes['privacy.label']).to.deep.equal({ old: 'Public', new: 'Unlisted' })
      expect(update.changes['category.id'].new).to.equal(2)
      expect(update.changes['tags']).to.deep.equal({ old: [ 'tag1' ], new: [ 'tag1', 'tag2' ] })

      expect(remove.changes).to.be.null
      expect(remove.entity.name).to.equal('audited video updated')
    })

    it('Should record user creation, update, block and deletion', async function () {
      const { id: userId } = await server.users.create({ username: 'audited_user', videoQuota: 42 })

      await server.users.update({ userId, videoQuota: 43 })
      await server.users.banUser({ userId, reason: 'audited block' })
      await server.users.remove({ userId })

      const logs = await server.logs.waitAuditLogs({ entityType: 'user', entityId: userId, total: 4 })
      expect(logs.map(l => l.action)).to.deep.equal([ 'create', 'update', 'update', 'delete' ])

      for (const log of logs) {
        expect(log.user).to.deep.equal({ id: rootId, username: 'root' })
        expect(log.entity.username).to.equal('audited_user')
        expect(log.entity.account.name).to.equal('audited_user')
        expect(log.entity.videoChannels).to.not.exist
      }

      expect(logs[0].entity.videoQuota).to.equal(42)
      expect(logs[0].entity.adminFlags).to.exist

      // Admin flags must not appear as a change
      expect(logs[1].changes).to.deep.equal({ videoQuota: { old: 42, new: 43 } })

      expect(logs[2].changes).to.deep.equal({
        blocked: { old: false, new: true },
        blockedReason: { old: null, new: 'audited block' }
      })
    })

    it('Should keep the username of a user that deleted their account', async function () {
      const { token, userId } = await server.users.generate('audited_self_delete')

      await server.users.deleteMe({ token })

      const logs = await server.logs.waitAuditLogs({ entityType: 'user', entityId: userId, action: 'delete', total: 1 })

      expect(logs[0].user).to.deep.equal({ id: null, username: 'audited_self_delete' })
      expect(logs[0].entity.username).to.equal('audited_self_delete')
    })

    it('Should record a direct registration', async function () {
      await server.config.enableSignup(false)

      await server.registrations.register({ username: 'audited_registered' })

      const logs = await server.logs.waitAuditLogs({ entityType: 'user', action: 'create', search: 'audited_registered', total: 1 })

      expect(logs[0].user.username).to.equal('audited_registered')
      expect(logs[0].user.id).to.equal(logs[0].entityId)
      expect(logs[0].entity.username).to.equal('audited_registered')
    })

    it('Should record channel updates', async function () {
      const channelId = server.store.channel.id

      await server.channels.update({ channelName: 'root_channel', attributes: { displayName: 'audited display name' } })
      await server.channels.updateImage({ channelName: 'root_channel', type: 'avatar' })
      await server.channels.updateImage({ channelName: 'root_channel', type: 'banner' })

      const logs = await server.logs.waitAuditLogs({ entityType: 'channel', entityId: channelId, total: 3 })
      expect(logs.map(l => l.action)).to.deep.equal([ 'update', 'update', 'update' ])

      expect(Object.keys(logs[0].changes)).to.deep.equal([ 'displayName' ])
      expect(logs[0].changes['displayName'].new).to.equal('audited display name')

      expect(Object.keys(logs[1].changes)).to.deep.equal([ 'avatars' ])
      expect(logs[1].changes['avatars'].old).to.deep.equal([])
      expect(logs[1].changes['avatars'].new).to.have.length.above(0)

      expect(Object.keys(logs[2].changes)).to.deep.equal([ 'banners' ])
      expect(logs[2].changes['banners'].new).to.have.length.above(0)
    })

    it('Should record instance config updates and resets', async function () {
      const startDate = new Date()

      const config = await server.config.getCustomConfig()
      const oldName = config.instance.name
      const old144p = config.transcoding.resolutions['144p']

      await server.config.updateExistingConfig({
        newConfig: {
          instance: { name: 'audited instance' },
          transcoding: { resolutions: { '144p': !old144p } }
        }
      })

      await server.config.deleteCustomConfig()

      const logs = await server.logs.waitAuditLogs({ entityType: 'config', startDate, total: 2 })

      for (const log of logs) {
        expect(log.action).to.equal('update')
        expect(log.entityId).to.be.null
        expect(log.user.username).to.equal('root')
      }

      expect(logs[0].changes).to.deep.equal({
        'instance.name': { old: oldName, new: 'audited instance' },
        'transcoding.resolutions.144p': { old: old144p, new: !old144p }
      })
      expect(logs[0].entity.instance.name).to.equal('audited instance')

      expect(logs[1].changes['instance.name']).to.deep.equal({ old: 'audited instance', new: oldName })
    })

    it('Should record an abuse report', async function () {
      const { uuid } = await server.videos.quickUpload({ name: 'audited abused video' })
      const token = await server.users.generateUserAndToken('audited_reporter')

      const { abuse } = await server.abuses.report({ token, videoId: uuid, reason: 'audited abuse reason' })

      const logs = await server.logs.waitAuditLogs({ entityType: 'abuse', entityId: abuse.id, total: 1 })

      expect(logs[0].action).to.equal('create')
      expect(logs[0].user.username).to.equal('audited_reporter')
      expect(logs[0].user.id).to.be.a('number')
      expect(logs[0].entity.reason).to.equal('audited abuse reason')
      expect(logs[0].entity.reporterAccount.name).to.equal('audited_reporter')
      expect(logs[0].entity.flaggedAccount.name).to.equal('root')
      expect(logs[0].entity.video.uuid).to.equal(uuid)
    })

    it('Should record a comment creation and deletion', async function () {
      const { uuid } = await server.videos.quickUpload({ name: 'audited commented video' })

      const comment = await server.comments.createThread({ videoId: uuid, text: 'audited comment' })
      await server.comments.delete({ videoId: uuid, commentId: comment.id })

      const logs = await server.logs.waitAuditLogs({ entityType: 'comment', entityId: comment.id, total: 2 })

      expect(logs.map(l => l.action)).to.deep.equal([ 'create', 'delete' ])
      expect(logs[0].entity.text).to.equal('audited comment')
      expect(logs[0].entity.account.name).to.equal('root')

      for (const log of logs) {
        expect(log.entity.video.uuid).to.equal(uuid)
        expect(log.entity.video.name).to.equal('audited commented video')
      }
    })
  })

  describe('Listing', function () {
    it('Should paginate and sort audit logs', async function () {
      const asc = await server.logs.listAuditLogs({ start: 0, count: 100, sort: 'createdAt' })
      expect(asc.total).to.be.above(10)

      const desc = await server.logs.listAuditLogs({ start: 0, count: 1, sort: '-createdAt' })
      expect(desc.total).to.equal(asc.total)
      expect(desc.data).to.have.lengthOf(1)
      expect(desc.data[0].id).to.equal(asc.data[asc.data.length - 1].id)

      const second = await server.logs.listAuditLogs({ start: 1, count: 1, sort: 'createdAt' })
      expect(second.data[0].id).to.equal(asc.data[1].id)
    })

    it('Should filter by entity type and action', async function () {
      const body = await server.logs.listAuditLogs({ entityType: 'video', action: 'delete' })

      expect(body.total).to.equal(1)
      expect(body.data[0].entity.name).to.equal('audited video updated')
    })

    it('Should search in usernames and entities', async function () {
      {
        const body = await server.logs.listAuditLogs({ search: 'audited_reporter' })

        expect(body.total).to.be.above(0)
        expect(body.data.some(l => l.user.username === 'audited_reporter')).to.be.true
      }

      {
        const body = await server.logs.listAuditLogs({ search: 'AUDITED VIDEO UPDATED' })

        expect(body.data.map(l => l.action)).to.have.members([ 'update', 'delete' ])
      }

      {
        const body = await server.logs.listAuditLogs({ search: 'nothing matches this search' })

        expect(body.total).to.equal(0)
      }
    })

    it('Should filter by date', async function () {
      const all = await server.logs.listAuditLogs({ sort: 'createdAt', count: 100 })
      const middle = all.data[5]

      {
        const body = await server.logs.listAuditLogs({ sort: 'createdAt', count: 100, startDate: new Date(middle.createdAt) })

        expect(body.data[0].createdAt).to.equal(middle.createdAt)
      }

      {
        const body = await server.logs.listAuditLogs({ sort: 'createdAt', count: 100, endDate: new Date(middle.createdAt) })

        expect(body.data[body.data.length - 1].createdAt).to.equal(middle.createdAt)
      }

      {
        const body = await server.logs.listAuditLogs({ startDate: new Date(Date.now() + 3600 * 1000) })

        expect(body.total).to.equal(0)
      }
    })

    it('Should list audit logs with the default array format', async function () {
      const startDate = new Date()

      await server.videos.quickUpload({ name: 'audited array video' })

      const [ listed ] = await server.logs.waitAuditLogs({ startDate, entityType: 'video', total: 1 })

      const body = await getAuditLogsArray({ startDate })
      expect(body).to.be.an('array').with.lengthOf(1)
      expect(body[0]).to.deep.equal(listed)

      expect(body[0].entity.name).to.equal('audited array video')
    })

    it('Should include the fields of the previous log file format', async function () {
      const startDate = new Date()

      await server.videos.quickUpload({ name: 'audited legacy video' })

      for (const log of [ ...await server.logs.waitAuditLogs({ startDate, total: 1 }), ...await getAuditLogsArray({ startDate }) ]) {
        expect(log.level).to.equal('audit')
        expect(log.timestamp).to.equal(log.createdAt)

        const message = JSON.parse(log.message)
        expect(message.user).to.equal('root')
        expect(message.domain).to.equal('video')
        expect(message.action).to.equal('create')
        expect(message.name).to.equal('audited legacy video')
      }
    })
  })

  describe('Configuration', function () {
    let disabledDate: Date

    it('Should not record audit logs when disabled', async function () {
      this.timeout(60000)

      await killallServers([ server ])
      await server.run({ log: { audit: { enabled: false } } })

      disabledDate = new Date()

      await server.videos.quickUpload({ name: 'not audited video' })

      await server.logs.listAuditLogs({ expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await getAuditLogsArray({ startDate: disabledDate, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should record audit logs again when re-enabled', async function () {
      this.timeout(60000)

      await killallServers([ server ])
      await server.run({ log: { audit: { enabled: true } } })

      await server.videos.quickUpload({ name: 'audited again video' })

      const logs = await server.logs.waitAuditLogs({ startDate: disabledDate, total: 1 })
      expect(logs[0].entity.name).to.equal('audited again video')
    })

    it('Should not clean audit logs that are not old enough', async function () {
      this.timeout(60000)

      await killallServers([ server ])
      await server.run({ log: { audit: { max_age: '10 days' } } })

      await wait(6000)

      const body = await server.logs.listAuditLogs()
      expect(body.total).to.be.above(0)
    })

    it('Should clean old audit logs', async function () {
      this.timeout(60000)

      await killallServers([ server ])
      await server.run({ log: { audit: { max_age: '5 seconds' } } })

      await wait(6000)

      const body = await server.logs.listAuditLogs()
      expect(body.total).to.equal(0)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
