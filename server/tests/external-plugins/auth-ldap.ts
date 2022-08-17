/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@shared/server-commands'
import { HttpStatusCode } from '@shared/models'

describe('Official plugin auth-ldap', function () {
  let server: PeerTubeServer
  let accessToken: string
  let userId: number

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
        'bind-credentials': 'GoodNewsEveryone',
        'bind-dn': 'cn=admin,dc=planetexpress,dc=com',
        'insecure-tls': false,
        'mail-property': 'mail',
        'search-base': 'ou=people,dc=planetexpress,dc=com',
        'search-filter': '(|(mail={{username}})(uid={{username}}))',
        'url': 'ldap://localhost:390',
        'username-property': 'uid'
      }
    })

    await server.login.login({ user: { username: 'fry', password: 'fry' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should not login with good LDAP settings but wrong username/password', async function () {
    await server.plugins.updateSettings({
      npmName: 'peertube-plugin-auth-ldap',
      settings: {
        'bind-credentials': 'GoodNewsEveryone',
        'bind-dn': 'cn=admin,dc=planetexpress,dc=com',
        'insecure-tls': false,
        'mail-property': 'mail',
        'search-base': 'ou=people,dc=planetexpress,dc=com',
        'search-filter': '(|(mail={{username}})(uid={{username}}))',
        'url': 'ldap://localhost:10389',
        'username-property': 'uid'
      }
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
