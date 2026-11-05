/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { AuditLogActionType, AuditLogEntityTypeType, VideoCommentPolicy, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  CLICommand,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { writeFile } from 'fs/promises'

describe('Test audit log coverage', function () {
  let servers: PeerTubeServer[]
  let server: PeerTubeServer

  let userId: number
  let userToken: string
  let userChannelId: number

  let videoId: number
  let videoUUID: string

  function waitAuditLog (options: {
    entityType: AuditLogEntityTypeType
    action: AuditLogActionType
    startDate: Date
    total?: number // default 1
  }) {
    return server.logs.waitAuditLogs({ ...options, total: options.total ?? 1 })
  }

  async function expectAuditLog (options: Parameters<typeof waitAuditLog>[0] & { username?: string }) {
    const [ log ] = await waitAuditLog(options)

    if (options.username) expect(log.user.username).to.equal(options.username)

    return log
  }

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(2)
    server = servers[0]

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await setDefaultAccountAvatar(servers)

    const user = await server.users.generate('audit_user')
    userId = user.userId
    userToken = user.token
    userChannelId = user.userChannelId

    const video = await server.videos.quickUpload({ name: 'audit video' })
    videoId = video.id
    videoUUID = video.uuid

    await waitJobs(servers)
  })

  describe('Moderation', function () {
    it('Should record abuse updates, messages and deletions', async function () {
      const startDate = new Date()

      const { abuse } = await server.abuses.report({ token: userToken, videoId, reason: 'audit abuse' })

      await server.abuses.update({ abuseId: abuse.id, body: { state: 2, moderationComment: 'audit comment' } })
      const messageRes = await server.abuses.addMessage({ abuseId: abuse.id, message: 'audit message' })
      await server.abuses.deleteMessage({ abuseId: abuse.id, messageId: messageRes.body.abuseMessage.id })
      await server.abuses.delete({ abuseId: abuse.id })

      const update = await expectAuditLog({ entityType: 'abuse', action: 'update', startDate, username: 'root' })
      expect(update.changes['state']).to.deep.equal({ old: 1, new: 2 })
      expect(update.changes['moderationComment'].new).to.equal('audit comment')

      const message = await expectAuditLog({ entityType: 'abuse-message', action: 'create', startDate })
      expect(message.entity.message).to.equal('audit message')

      await expectAuditLog({ entityType: 'abuse-message', action: 'delete', startDate })
      await expectAuditLog({ entityType: 'abuse', action: 'delete', startDate })
    })

    it('Should record video blocks', async function () {
      const startDate = new Date()

      await server.blacklist.add({ videoId, reason: 'audit reason' })
      await server.blacklist.update({ videoId, reason: 'audit reason 2' })
      await server.blacklist.remove({ videoId })

      const create = await expectAuditLog({ entityType: 'video-block', action: 'create', startDate, username: 'root' })
      expect(create.entity.video.uuid).to.equal(videoUUID)

      const update = await expectAuditLog({ entityType: 'video-block', action: 'update', startDate })
      expect(update.changes).to.deep.equal({ reason: { old: 'audit reason', new: 'audit reason 2' } })

      await expectAuditLog({ entityType: 'video-block', action: 'delete', startDate })
    })

    it('Should record instance account and server mutes', async function () {
      const startDate = new Date()

      await server.blocklist.addToServerBlocklist({ account: 'audit_user' })
      await server.blocklist.removeFromServerBlocklist({ account: 'audit_user' })
      await server.blocklist.addToServerBlocklist({ server: servers[1].host })
      await server.blocklist.removeFromServerBlocklist({ server: servers[1].host })

      const accountBlock = await expectAuditLog({ entityType: 'account-block', action: 'create', startDate, username: 'root' })
      expect(accountBlock.entity.targetAccount.handle).to.equal('audit_user@' + server.host)

      const accountUnblock = await expectAuditLog({ entityType: 'account-block', action: 'delete', startDate })
      expect(accountUnblock.entityId).to.equal(accountBlock.entityId)

      const serverBlock = await expectAuditLog({ entityType: 'server-block', action: 'create', startDate })
      expect(serverBlock.entity.targetServer.host).to.equal(servers[1].host)

      await expectAuditLog({ entityType: 'server-block', action: 'delete', startDate })
    })

    it('Should record registration requests and moderation', async function () {
      this.timeout(60000)

      const startDate = new Date()

      await server.config.enableSignup(true)

      await server.registrations.requestRegistration({ username: 'audit_registration_1', registrationReason: 'reason' })
      await server.registrations.requestRegistration({ username: 'audit_registration_2', registrationReason: 'reason' })

      const { data } = await server.registrations.list({ sort: 'createdAt' })
      const r1 = data.find(r => r.username === 'audit_registration_1')
      const r2 = data.find(r => r.username === 'audit_registration_2')

      await server.registrations.accept({ id: r1.id, moderationResponse: 'welcome' })
      await server.registrations.reject({ id: r2.id, moderationResponse: 'no' })
      await server.registrations.delete({ id: r2.id })

      const requests = await waitAuditLog({ entityType: 'registration', action: 'create', startDate, total: 2 })
      expect(requests[0].user.username).to.equal('anonymous')
      expect(requests[0].entity.username).to.equal('audit_registration_1')

      const updates = await waitAuditLog({ entityType: 'registration', action: 'update', startDate, total: 2 })
      expect(updates[0].user.username).to.equal('root')
      expect(updates[0].changes['state']).to.deep.equal({ old: 1, new: 3 })
      expect(updates[1].changes['state']).to.deep.equal({ old: 1, new: 2 })

      const user = await expectAuditLog({ entityType: 'user', action: 'create', startDate, username: 'root' })
      expect(user.entity.username).to.equal('audit_registration_1')

      await expectAuditLog({ entityType: 'registration', action: 'delete', startDate })
    })

    it('Should record comment approvals and bulk deletions', async function () {
      this.timeout(60000)

      const startDate = new Date()

      const { uuid } = await server.videos.upload({
        attributes: { name: 'audit approval video', commentsPolicy: VideoCommentPolicy.REQUIRES_APPROVAL }
      })
      const comment = await server.comments.createThread({ token: userToken, videoId: uuid, text: 'audit held comment' })
      await server.comments.approve({ videoId: uuid, commentId: comment.id })

      const approval = await expectAuditLog({ entityType: 'comment', action: 'update', startDate, username: 'root' })
      expect(approval.changes).to.deep.equal({ heldForReview: { old: true, new: false } })
      expect(approval.entity.video.uuid).to.equal(uuid)

      await server.comments.createThread({ token: userToken, videoId: uuid, text: 'audit bulk comment 1' })
      await server.comments.createThread({ token: userToken, videoId: uuid, text: 'audit bulk comment 2' })

      // Automatic tags jobs update the comments, wait for them to not conflict with the bulk removal
      await waitJobs(servers)

      await server.bulk.removeCommentsOf({ attributes: { accountName: 'audit_user', scope: 'instance' } })
      await waitJobs(servers)

      const deletions = await waitAuditLog({ entityType: 'comment', action: 'delete', startDate, total: 3 })
      for (const log of deletions) {
        expect(log.user.username).to.equal('root')
        expect(log.entity.account.name).to.equal('audit_user')
        expect(log.entity.video.uuid).to.equal(uuid)
      }
    })

    it('Should record watched words lists and automatic tag policies', async function () {
      const startDate = new Date()

      const { watchedWordsList } = await server.watchedWordsLists.createList({ listName: 'audit list', words: [ 'a' ] })
      await server.watchedWordsLists.updateList({ listId: watchedWordsList.id, words: [ 'a', 'b' ] })
      await server.watchedWordsLists.deleteList({ listId: watchedWordsList.id })

      await server.autoTags.updateServerVideoPolicies({ autoBlock: [ 'external-link' ] })

      const update = await expectAuditLog({ entityType: 'watched-words-list', action: 'update', startDate, username: 'root' })
      expect(update.changes).to.deep.equal({ words: { old: [ 'a' ], new: [ 'a', 'b' ] } })

      await expectAuditLog({ entityType: 'watched-words-list', action: 'create', startDate })
      await expectAuditLog({ entityType: 'watched-words-list', action: 'delete', startDate })

      const policy = await expectAuditLog({ entityType: 'automatic-tag-policy', action: 'update', startDate })
      expect(policy.changes['tags']).to.deep.equal({ old: [], new: [ 'external-link' ] })
    })
  })

  describe('Administration', function () {
    it('Should record follows', async function () {
      this.timeout(60000)

      const startDate = new Date()

      await doubleFollow(servers[0], servers[1])

      await server.follows.unfollow({ target: servers[1] })
      await servers[0].follows.removeFollower({ follower: servers[1] })
      await waitJobs(servers)

      const follow = await expectAuditLog({ entityType: 'follow', action: 'create', startDate, username: 'root' })
      expect(follow.entity.following).to.equal(servers[1].host)

      const deletions = await waitAuditLog({ entityType: 'follow', action: 'delete', startDate, total: 2 })
      expect(deletions.map(d => d.entity.state)).to.deep.equal([ 'accepted', 'accepted' ])
    })

    it('Should record server redundancy updates', async function () {
      this.timeout(60000)

      const startDate = new Date()

      await server.follows.follow({ hosts: [ servers[1].url ] })
      await waitJobs(servers)

      await server.redundancy.updateRedundancy({ host: servers[1].host, redundancyAllowed: true })

      const log = await expectAuditLog({ entityType: 'server-redundancy', action: 'update', startDate, username: 'root' })
      expect(log.changes).to.deep.equal({ redundancyAllowed: { old: false, new: true } })
    })

    it('Should record plugin installation, settings, update and uninstallation', async function () {
      this.timeout(120000)

      const startDate = new Date()

      await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-five') })
      await server.plugins.updateSettings({ npmName: 'peertube-plugin-test-five', settings: { 'my-setting': 'value' } })
      await server.plugins.update({ path: PluginsCommand.getPluginTestPath('-five') })
      await server.plugins.uninstall({ npmName: 'peertube-plugin-test-five' })

      const install = await expectAuditLog({ entityType: 'plugin', action: 'create', startDate, username: 'root' })
      expect(install.entity.npmName).to.equal('peertube-plugin-test-five')

      // Updating the plugin to the same version doesn't change anything, so only the settings update is recorded
      const update = await expectAuditLog({ entityType: 'plugin', action: 'update', startDate })

      // The plugin doesn't register this setting: we don't know if it's a secret, so it is hidden
      const settingChange = update.changes['settings.my-setting']
      expect(settingChange.old).to.be.null
      expect(settingChange.new).to.match(/^\[hidden:[a-f0-9]{12}\]$/)
      expect(JSON.stringify(update)).to.not.include('"value"')

      await expectAuditLog({ entityType: 'plugin', action: 'delete', startDate })
    })

    it('Should record job queue, runner, debug and instance actions', async function () {
      this.timeout(60000)

      const startDate = new Date()

      await server.jobs.pauseJobQueue()
      await server.jobs.resumeJobQueue()

      await server.runnerRegistrationTokens.generate()
      const { data } = await server.runnerRegistrationTokens.list({ sort: '-createdAt' })
      const registrationToken = data[0]

      const { id: runnerId } = await server.runners.register({
        name: 'audit runner',
        registrationToken: registrationToken.registrationToken
      })
      await server.runners.delete({ id: runnerId })
      await server.runnerRegistrationTokens.delete({ id: registrationToken.id })

      await server.debug.sendCommand({ body: { command: 'process-video-viewers' } })

      await server.config.updateInstanceImage({ type: 1, fixture: 'avatar.png' })
      await server.config.deleteInstanceImage({ type: 1 })
      await server.customPage.updateInstanceHomepage({ content: 'audit homepage' })

      const jobQueue = await waitAuditLog({ entityType: 'job-queue', action: 'update', startDate, total: 2 })
      expect(jobQueue.map(j => j.changes)).to.deep.equal([
        { paused: { old: false, new: true } },
        { paused: { old: true, new: false } }
      ])

      const token = await expectAuditLog({ entityType: 'runner-registration-token', action: 'create', startDate, username: 'root' })
      expect(token.entity).to.deep.equal({ id: registrationToken.id })

      await expectAuditLog({ entityType: 'runner-registration-token', action: 'delete', startDate })

      await expectAuditLog({ entityType: 'runner', action: 'create', startDate, username: 'runner:audit runner' })
      await expectAuditLog({ entityType: 'runner', action: 'delete', startDate, username: 'root' })

      const command = await expectAuditLog({ entityType: 'debug-command', action: 'create', startDate })
      expect(command.entity.command).to.equal('process-video-viewers')

      await expectAuditLog({ entityType: 'instance-image', action: 'create', startDate })
      await expectAuditLog({ entityType: 'instance-image', action: 'delete', startDate })

      const homepage = await expectAuditLog({ entityType: 'instance-homepage', action: 'update', startDate })
      expect(homepage.changes['content'].new).to.equal('audit homepage')
    })

    it('Should record actions of CLI scripts', async function () {
      this.timeout(120000)

      const startDate = new Date()

      await CLICommand.exec(`echo audit_password | ${server.cli.getEnv()} npm run reset-password -- -u audit_user`)

      const reset = await expectAuditLog({ entityType: 'user', action: 'update', startDate, username: 'cli' })
      expect(reset.changes).to.deep.equal({ password: { old: '[hidden]', new: '[hidden]' } })

      userToken = await server.login.getAccessToken({ username: 'audit_user', password: 'audit_password' })

      await writeFile(server.servers.buildDirectory('web-videos/audit-orphan.mp4'), 'orphan')
      await server.cli.execWithEnv('npm run prune-storage -- -y')

      const prune = await expectAuditLog({ entityType: 'storage-prune', action: 'delete', startDate, username: 'cli' })
      expect(prune.entity.storage).to.equal('file-system')
      expect(prune.entity.deletedFiles).to.be.at.least(1)
    })
  })

  describe('Account security', function () {
    it('Should record logins, failed logins and logouts', async function () {
      const startDate = new Date()

      await server.login.login({ user: { username: 'audit_user', password: 'bad password' }, expectedStatus: 400 })
      const { access_token: accessToken } = await server.login.login({ user: { username: 'audit_user', password: 'audit_password' } })
      await server.login.logout({ token: accessToken })

      const failed = await expectAuditLog({ entityType: 'failed-login', action: 'create', startDate, username: 'anonymous' })
      expect(failed.entity.username).to.equal('audit_user')

      const login = await expectAuditLog({ entityType: 'token-session', action: 'create', startDate, username: 'audit_user' })
      expect(login.ip).to.include('127.0.0.1')

      await expectAuditLog({ entityType: 'token-session', action: 'delete', startDate, username: 'audit_user' })
    })

    it('Should record password, email and two factor changes', async function () {
      const startDate = new Date()

      await server.users.updateMe({ token: userToken, currentPassword: 'audit_password', password: 'audit_password_2' })
      userToken = await server.login.getAccessToken({ username: 'audit_user', password: 'audit_password_2' })

      await server.users.updateMe({ token: userToken, displayName: 'audit display name' })

      await server.twoFactor.requestAndConfirm({ token: userToken, userId, currentPassword: 'audit_password_2' })

      const updates = await waitAuditLog({ entityType: 'user', action: 'update', startDate, total: 3 })
      expect(updates[0].changes).to.deep.equal({ password: { old: '[hidden]', new: '[hidden]' } })
      expect(updates[1].changes['account.displayName'].new).to.equal('audit display name')
      expect(updates[2].changes).to.deep.equal({ twoFactorEnabled: { old: false, new: true } })

      await server.twoFactor.disable({ token: userToken, userId, currentPassword: 'audit_password_2' })
    })

    it('Should record password reset requests and scoped token renewals', async function () {
      const startDate = new Date()

      await server.users.askResetPassword({ email: 'audit_user@example.com' })
      await server.users.renewMyScopedTokens({ token: userToken })

      const reset = await expectAuditLog({ entityType: 'password-reset', action: 'create', startDate, username: 'anonymous' })
      expect(reset.entity.user.username).to.equal('audit_user')

      const renew = await expectAuditLog({ entityType: 'scoped-token', action: 'update', startDate, username: 'audit_user' })
      expect(renew.changes).to.deep.equal({ feedToken: { old: '[hidden]', new: '[hidden]' } })
    })

    it('Should record user exports and imports', async function () {
      this.timeout(120000)

      const startDate = new Date()

      await server.config.enableUserExport()
      await server.config.enableUserImport()

      const { export: userExport } = await server.userExports.request({ token: userToken, userId, withVideoFiles: false })
      await server.userExports.waitForCreation({ token: userToken, userId })
      await server.userExports.delete({ token: userToken, userId, exportId: userExport.id })

      await server.userImports.importArchive({ token: userToken, userId, fixture: 'export-without-files.zip' })
      await waitJobs(servers)

      const exportLog = await expectAuditLog({ entityType: 'user-export', action: 'create', startDate, username: 'audit_user' })
      expect(exportLog.entity.withVideoFiles).to.be.false

      await expectAuditLog({ entityType: 'user-export', action: 'delete', startDate })
      await expectAuditLog({ entityType: 'user-import', action: 'create', startDate, username: 'audit_user' })
    })
  })

  describe('Content', function () {
    it('Should record live creation and update', async function () {
      this.timeout(60000)

      const startDate = new Date()

      await server.config.enableMinimumTranscoding()
      await server.config.enableLive({ allowReplay: true })

      const live = await server.live.create({
        fields: { name: 'audit live', channelId: server.store.channel.id, privacy: VideoPrivacy.PUBLIC, saveReplay: false }
      })
      await server.live.update({ videoId: live.uuid, fields: { saveReplay: true, replaySettings: { privacy: VideoPrivacy.UNLISTED } } })

      const create = await expectAuditLog({ entityType: 'video', action: 'create', startDate, username: 'root' })
      expect(create.entity.isLive).to.be.true

      const update = await expectAuditLog({ entityType: 'video-live', action: 'update', startDate })
      expect(update.changes['saveReplay']).to.deep.equal({ old: false, new: true })
      expect(update.changes['replaySettings.privacy']).to.deep.equal({ old: null, new: VideoPrivacy.UNLISTED })
    })

    it('Should record captions, chapters, passwords, embed privacy and player settings', async function () {
      this.timeout(60000)

      const startDate = new Date()

      await server.captions.add({ videoId, language: 'fr', fixture: 'subtitle-good1.vtt' })
      await server.captions.delete({ videoId, language: 'fr' })

      await server.chapters.update({ videoId, chapters: [ { timecode: 1, title: 'audit chapter' } ] })

      const { uuid: passwordVideoUUID } = await server.videos.quickUpload({
        name: 'audit password video',
        privacy: VideoPrivacy.PASSWORD_PROTECTED,
        videoPasswords: [ 'password1' ]
      })
      await server.videoPasswords.updateAll({ videoId: passwordVideoUUID, passwords: [ 'password2', 'password3' ] })

      await server.videoEmbedPrivacy.update({ videoId, policy: 2, domains: [ 'example.com' ] })

      await server.playerSettings.updateForVideo({ videoId, theme: 'lucide' })
      await server.playerSettings.updateForChannel({ channelHandle: 'root_channel', theme: 'lucide' })

      await expectAuditLog({ entityType: 'video-caption', action: 'create', startDate, username: 'root' })
      await expectAuditLog({ entityType: 'video-caption', action: 'delete', startDate })

      const chapters = await expectAuditLog({ entityType: 'video-chapters', action: 'update', startDate })
      expect(chapters.changes['chapters'].new).to.deep.equal([ { timecode: 1, title: 'audit chapter' } ])

      const passwords = await expectAuditLog({ entityType: 'video-password', action: 'update', startDate })
      expect(passwords.changes).to.deep.equal({
        passwordsCount: { old: 1, new: 2 },
        passwords: { old: '[hidden]', new: '[hidden]' }
      })
      expect(JSON.stringify(passwords)).to.not.include('password2')

      const embed = await expectAuditLog({ entityType: 'video-embed-privacy', action: 'update', startDate })
      expect(embed.changes['domains']).to.deep.equal({ old: [], new: [ 'example.com' ] })

      const player = await expectAuditLog({ entityType: 'video-player-settings', action: 'update', startDate })
      expect(player.entityId).to.equal(videoId)
      expect(player.changes['theme'].new).to.equal('lucide')

      const channelPlayer = await expectAuditLog({ entityType: 'channel-player-settings', action: 'update', startDate })
      expect(channelPlayer.entityId).to.equal(server.store.channel.id)
      expect(channelPlayer.changes['theme'].new).to.equal('lucide')
    })

    it('Should record video file deletions and transcoding requests', async function () {
      this.timeout(120000)

      const startDate = new Date()

      await server.config.enableMinimumTranscoding({ hls: true, webVideo: true })

      const { uuid } = await server.videos.quickUpload({ name: 'audit transcoded video' })
      await waitJobs(servers)

      await server.videos.removeAllWebVideoFiles({ videoId: uuid })
      await server.videos.runTranscoding({ videoId: uuid, transcodingType: 'web-video' })
      await waitJobs(servers)

      const deletion = await expectAuditLog({ entityType: 'video-file', action: 'delete', startDate, username: 'root' })
      expect(deletion.entity.type).to.equal('web-video')

      const transcoding = await expectAuditLog({ entityType: 'video-transcoding', action: 'create', startDate })
      expect(transcoding.entity.transcodingType).to.equal('web-video')
    })

    it('Should record ownership changes and channel collaborators', async function () {
      this.timeout(60000)

      const startDate = new Date()

      const { uuid } = await server.videos.quickUpload({ name: 'audit ownership video' })
      await server.changeOwnership.createVideo({ videoId: uuid, username: 'audit_user' })

      const { data } = await server.changeOwnership.listVideos({ token: userToken })
      await server.changeOwnership.acceptVideo({ token: userToken, ownershipId: data[0].id, channelId: userChannelId })

      const { id: collaboratorId } = await server.channelCollaborators.invite({ channel: 'root_channel', target: 'audit_user' })
      await server.channelCollaborators.accept({ token: userToken, channel: 'root_channel', id: collaboratorId })
      await server.channelCollaborators.remove({ channel: 'root_channel', id: collaboratorId })

      const create = await expectAuditLog({ entityType: 'ownership-change', action: 'create', startDate, username: 'root' })
      expect(create.entity.video.uuid).to.equal(uuid)

      const accept = await expectAuditLog({ entityType: 'ownership-change', action: 'update', startDate, username: 'audit_user' })
      expect(accept.changes['state.id']).to.deep.equal({ old: 1, new: 3 })

      await expectAuditLog({ entityType: 'channel-collaborator', action: 'create', startDate, username: 'root' })
      await expectAuditLog({ entityType: 'channel-collaborator', action: 'update', startDate, username: 'audit_user' })
      await expectAuditLog({ entityType: 'channel-collaborator', action: 'delete', startDate, username: 'root' })
    })

    it('Should record playlist changes', async function () {
      const startDate = new Date()

      const playlist = await server.playlists.create({
        attributes: { displayName: 'audit playlist', privacy: VideoPrivacy.PUBLIC, videoChannelId: server.store.channel.id }
      })
      await server.playlists.update({ playlistId: playlist.id, attributes: { displayName: 'audit playlist 2' } })

      const element1 = await server.playlists.addElement({ playlistId: playlist.id, attributes: { videoId } })
      await server.playlists.addElement({ playlistId: playlist.id, attributes: { videoId } })
      await server.playlists.updateElement({ playlistId: playlist.id, elementId: element1.id, attributes: { startTimestamp: 2 } })
      await server.playlists.reorderElements({ playlistId: playlist.id, attributes: { startPosition: 1, insertAfterPosition: 2 } })
      await server.playlists.removeElement({ playlistId: playlist.id, elementId: element1.id })
      await server.playlists.delete({ playlistId: playlist.id })

      await expectAuditLog({ entityType: 'playlist', action: 'create', startDate, username: 'root' })

      const update = await expectAuditLog({ entityType: 'playlist', action: 'update', startDate })
      expect(update.changes).to.deep.equal({ displayName: { old: 'audit playlist', new: 'audit playlist 2' } })

      await waitAuditLog({ entityType: 'playlist-element', action: 'create', startDate, total: 2 })

      const elementUpdate = await expectAuditLog({ entityType: 'playlist-element', action: 'update', startDate })
      expect(elementUpdate.changes).to.deep.equal({ startTimestamp: { old: null, new: 2 } })

      const order = await expectAuditLog({ entityType: 'playlist-elements-order', action: 'update', startDate })
      expect(order.changes).to.deep.equal({ position: { old: 1, new: 2 } })

      await expectAuditLog({ entityType: 'playlist-element', action: 'delete', startDate })
      await expectAuditLog({ entityType: 'playlist', action: 'delete', startDate })
    })

    it('Should record avatar changes of users and channels', async function () {
      const startDate = new Date()

      await server.users.updateMyAvatar({ token: userToken, fixture: 'avatar.png' })
      await server.channels.updateImage({ channelName: 'root_channel', type: 'avatar' })
      await server.channels.deleteImage({ channelName: 'root_channel', type: 'avatar' })

      const user = await expectAuditLog({ entityType: 'user', action: 'update', startDate, username: 'audit_user' })
      expect(Object.keys(user.changes)).to.deep.equal([ 'account.avatars' ])

      const channel = await waitAuditLog({ entityType: 'channel', action: 'update', startDate, total: 2 })
      expect(channel[0].changes['avatars'].old).to.deep.equal([])
      expect(channel[1].changes['avatars'].new).to.deep.equal([])
    })

    it('Should record scheduled privacy updates with the system actor', async function () {
      this.timeout(60000)

      const startDate = new Date()

      const updateAt = new Date(Date.now() + 1000)
      const { uuid } = await server.videos.upload({
        attributes: {
          name: 'audit scheduled video',
          privacy: VideoPrivacy.PRIVATE,
          scheduleUpdate: { updateAt: updateAt.toISOString(), privacy: VideoPrivacy.PUBLIC }
        }
      })

      const log = await expectAuditLog({ entityType: 'video', action: 'update', startDate, username: 'system' })
      expect(log.entity.uuid).to.equal(uuid)
      expect(log.changes['privacy.id']).to.deep.equal({ old: VideoPrivacy.PRIVATE, new: VideoPrivacy.PUBLIC })
      expect(log.user.id).to.be.null
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
