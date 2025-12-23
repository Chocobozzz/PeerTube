/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, UserRole } from '@peertube/peertube-models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Official plugin auth-ldap', function () {
  let server: PeerTubeServer
  let accessToken: string
  let userId: number

  const pluginSettings = {
    'bind-credentials': 'GoodNewsEveryone',
    'bind-dn': 'cn=admin,dc=planetexpress,dc=com',
    'insecure-tls': false,
    'mail-property': 'mail',
    'search-base': 'ou=people,dc=planetexpress,dc=com',
    'search-filter': '(|(mail={{username}})(uid={{username}}))',
    'url': 'ldap://127.0.0.1:10389',
    'username-property': 'uid'
  }

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    await server.plugins.install({ npmName: 'peertube-plugin-auth-ldap' })
  })

  it('Should not login with without LDAP settings', async function () {
    await server.login.login({ user: { username: 'fry', password: 'fry' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should not login with bad LDAP settings', async function () {
    await server.plugins.updateSettings({
      npmName: 'peertube-plugin-auth-ldap',
      settings: {
        ...pluginSettings,

        url: 'ldap://127.0.0.1:390'
      }
    })

    await server.login.login({ user: { username: 'fry', password: 'fry' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should not login with good LDAP settings but wrong username/password', async function () {
    await server.plugins.updateSettings({
      npmName: 'peertube-plugin-auth-ldap',
      settings: pluginSettings
    })

    await server.login.login({ user: { username: 'fry', password: 'bad password' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await server.login.login({ user: { username: 'fryr', password: 'fry' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should login with the appropriate username/password', async function () {
    accessToken = await server.login.getAccessToken({ username: 'fry', password: 'fry' })
  })

  it('Should login with the appropriate email/password', async function () {
    accessToken = await server.login.getAccessToken({ username: 'fry@planetexpress.com', password: 'fry' })
  })

  it('Should login get my profile', async function () {
    const body = await server.users.getMyInfo({ token: accessToken })
    expect(body.username).to.equal('fry')
    expect(body.email).to.equal('fry@planetexpress.com')

    userId = body.id
  })

  it('Should upload a video', async function () {
    await server.videos.upload({ token: accessToken, attributes: { name: 'my super video' } })
  })

  it('Should not be able to login if the user is banned', async function () {
    await server.users.banUser({ userId })

    await server.login.login({
      user: { username: 'fry@planetexpress.com', password: 'fry' },
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })
  })

  it('Should be able to login if the user is unbanned', async function () {
    await server.users.unbanUser({ userId })

    await server.login.login({ user: { username: 'fry@planetexpress.com', password: 'fry' } })
  })

  it('Should not be able to ask password reset', async function () {
    await server.users.askResetPassword({ email: 'fry@planetexpress.com', expectedStatus: HttpStatusCode.CONFLICT_409 })
  })

  it('Should not be able to ask email verification', async function () {
    await server.users.askSendVerifyEmail({ email: 'fry@planetexpress.com', expectedStatus: HttpStatusCode.CONFLICT_409 })
  })

  it('Should set the correct roles', async function () {
    await server.plugins.updateSettings({
      npmName: 'peertube-plugin-auth-ldap',
      settings: {
        ...pluginSettings,

        'group-base': 'ou=people,dc=planetexpress,dc=com',
        'group-filter': '(member={{dn}})',
        'group-admin': 'cn=admin_staff,ou=people,dc=planetexpress,dc=com',
        'group-mod': 'cn=unknown,ou=people,dc=planetexpress,dc=com',
        'group-user': 'cn=ship_crew,ou=people,dc=planetexpress,dc=com'
      }
    })

    {
      const accessToken = await server.login.getAccessToken({ username: 'professor', password: 'professor' })

      const { role } = await server.users.getMyInfo({ token: accessToken })
      expect(role.id).to.equal(UserRole.ADMINISTRATOR)
    }

    {
      const accessToken = await server.login.getAccessToken({ username: 'leela', password: 'leela' })

      const { role } = await server.users.getMyInfo({ token: accessToken })
      expect(role.id).to.equal(UserRole.USER)
    }
  })

  it('Should not login if the plugin is uninstalled', async function () {
    await server.plugins.uninstall({ npmName: 'peertube-plugin-auth-ldap' })

    await server.login.login({
      user: { username: 'fry@planetexpress.com', password: 'fry' },
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
