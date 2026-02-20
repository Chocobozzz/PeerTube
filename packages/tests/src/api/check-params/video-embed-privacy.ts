import { HttpStatusCode, VideoCreateResult, VideoEmbedPrivacyPolicy } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createSingleServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'

describe('Test video embed privacy validator', function () {
  let server: PeerTubeServer
  let video: VideoCreateResult

  let ownerAccessToken: string
  let userAccessToken: string
  let editorAccessToken: string
  let invitedEditorAccessToken: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    ownerAccessToken = await server.users.generateUserAndToken('owner')
    userAccessToken = await server.users.generateUserAndToken('user1')
    editorAccessToken = await server.channelCollaborators.createEditor('accepted_editor', 'owner_channel')
    invitedEditorAccessToken = await server.channelCollaborators.createInvited('invited_editor', 'owner_channel')

    video = await server.videos.upload({ token: ownerAccessToken })
  })

  describe('When getting embed privacy', function () {
    it('Should fail without a valid uuid', async function () {
      await server.videoEmbedPrivacy.get({ videoId: '4da6fd', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an unknown id', async function () {
      await server.videoEmbedPrivacy.get({
        videoId: 'ce0801ef-7124-48df-9b22-b473ace78797',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail without access token', async function () {
      await server.videoEmbedPrivacy.get({
        videoId: video.id,
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a bad access token', async function () {
      await server.videoEmbedPrivacy.get({
        videoId: video.id,
        token: 'toto',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with another user access token', async function () {
      await server.videoEmbedPrivacy.get({
        videoId: video.id,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an invited editor access token', async function () {
      await server.videoEmbedPrivacy.get({
        videoId: video.id,
        token: invitedEditorAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with correct params', async function () {
      for (const token of [ server.accessToken, ownerAccessToken, editorAccessToken ]) {
        await server.videoEmbedPrivacy.get({ videoId: video.id, token })
      }
    })
  })

  describe('When checking if embed is allowed on a domain', function () {
    it('Should fail without a valid uuid', async function () {
      await server.videoEmbedPrivacy.isDomainAllowed({
        videoId: '4da6fd',
        domain: 'example.com',
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with an unknown id', async function () {
      await server.videoEmbedPrivacy.isDomainAllowed({
        videoId: 'ce0801ef-7124-48df-9b22-b473ace78797',
        domain: 'example.com',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with an invalid domain', async function () {
      await server.videoEmbedPrivacy.isDomainAllowed({
        videoId: video.id,
        domain: '',
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with correct params', async function () {
      await server.videoEmbedPrivacy.isDomainAllowed({ videoId: video.id, domain: 'example.com' })
    })
  })

  describe('When updating embed privacy', function () {
    it('Should fail without a valid uuid', async function () {
      await server.videoEmbedPrivacy.update({
        videoId: '4da6fd',
        policy: VideoEmbedPrivacyPolicy.ALL_ALLOWED,
        domains: [],
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with an unknown id', async function () {
      await server.videoEmbedPrivacy.update({
        videoId: 'ce0801ef-7124-48df-9b22-b473ace78797',
        policy: VideoEmbedPrivacyPolicy.ALL_ALLOWED,
        domains: [],
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail without access token', async function () {
      await server.videoEmbedPrivacy.update({
        videoId: video.id,
        policy: VideoEmbedPrivacyPolicy.ALL_ALLOWED,
        domains: [],
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a bad access token', async function () {
      await server.videoEmbedPrivacy.update({
        videoId: video.id,
        policy: VideoEmbedPrivacyPolicy.ALL_ALLOWED,
        domains: [],
        token: 'toto',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with another user access token', async function () {
      await server.videoEmbedPrivacy.update({
        videoId: video.id,
        policy: VideoEmbedPrivacyPolicy.ALL_ALLOWED,
        domains: [],
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an invited editor access token', async function () {
      await server.videoEmbedPrivacy.update({
        videoId: video.id,
        policy: VideoEmbedPrivacyPolicy.ALL_ALLOWED,
        domains: [],
        token: invitedEditorAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an invalid policy', async function () {
      await server.videoEmbedPrivacy.update({
        videoId: video.id,
        policy: 999 as any,
        domains: [],
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await server.videoEmbedPrivacy.update({
        videoId: video.id,
        policy: VideoEmbedPrivacyPolicy.REMOTE_RESTRICTIONS,
        domains: [],
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with missing policy', async function () {
      await server.videoEmbedPrivacy.update({
        videoId: video.id,
        policy: undefined as any,
        domains: [],
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with invalid domains', async function () {
      await server.videoEmbedPrivacy.update({
        videoId: video.id,
        policy: VideoEmbedPrivacyPolicy.ALL_ALLOWED,
        domains: 'example.com' as any,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await server.videoEmbedPrivacy.update({
        videoId: video.id,
        policy: VideoEmbedPrivacyPolicy.ALL_ALLOWED,
        domains: [ 'http://example.com' ],
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with missing domains', async function () {
      await server.videoEmbedPrivacy.update({
        videoId: video.id,
        policy: VideoEmbedPrivacyPolicy.ALL_ALLOWED,
        domains: undefined as any,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with inconsistent policy', async function () {
      await server.videoEmbedPrivacy.update({
        videoId: video.id,
        policy: VideoEmbedPrivacyPolicy.ALL_ALLOWED,
        domains: [ 'example.com' ],
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with correct params', async function () {
      const policy = VideoEmbedPrivacyPolicy.ALLOWLIST
      const domains = [ 'example.com' ]

      for (const token of [ server.accessToken, ownerAccessToken, editorAccessToken ]) {
        await server.videoEmbedPrivacy.update({ videoId: video.id, token, policy, domains })
      }
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
