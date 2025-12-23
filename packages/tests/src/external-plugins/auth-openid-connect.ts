/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, HttpStatusCodeType, UserRole } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeRawRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { Response } from 'supertest'

const oauthServerHost = '127.0.0.1'
const oauthServerPort = 8082

describe('Official plugin auth-openid-connect', function () {
  let server: PeerTubeServer
  let openIdLoginUrl: string

  before(async function () {
    this.timeout(60000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    await server.plugins.install({ npmName: 'peertube-plugin-auth-openid-connect' })
  })

  it('Should load openid connect plugin', async function () {
    const config = await updatePluginSettings(server)

    const { name, version, authName } = config.plugin.registeredExternalAuths[0]
    openIdLoginUrl = server.url + `/plugins/${name}/${version}/auth/${authName}`
  })

  it('Should login with the appropriate username/password', async function () {
    const peertubeRes = await getOpenIdUrl(openIdLoginUrl)
    const kcRes = await loginOnKeycloak({ loginPageUrl: extractLocation(peertubeRes) })

    const ptBypassPath = await sendBackKeycloakCode({ peertubeRes, kcRes, success: true })
    const externalAuthToken = new URL(ptBypassPath, server.url).searchParams.get('externalAuthToken')

    const { body } = await server.login.loginUsingExternalToken({ username: 'myuser_example.com', externalAuthToken })

    const { username, role } = await server.users.getMyInfo({ token: body.access_token })
    expect(username).to.equal('myuser_example.com')
    expect(role.id).to.equal(UserRole.USER)
  })

  it('Should allow to redirect on the app by default', async function () {
    await getOpenIdUrl(openIdLoginUrl, 'peertube://joinpeertube.org/mysuperlogin', HttpStatusCode.FOUND_302)
    await getOpenIdUrl(openIdLoginUrl, 'peertube://joinpeertube.org/', HttpStatusCode.FOUND_302)
    await getOpenIdUrl(openIdLoginUrl, 'peertdube://joinpeertube.org/', HttpStatusCode.FORBIDDEN_403)
    await getOpenIdUrl(openIdLoginUrl, 'apeertube://joinpeertube.org/', HttpStatusCode.FORBIDDEN_403)
    await getOpenIdUrl(openIdLoginUrl, 'peertube://joinpeertube/', HttpStatusCode.FORBIDDEN_403)
  })

  it('Should not allow a redirect URL that is not in the allowed list', async function () {
    await updatePluginSettings(server, {
      'allowed-external-redirect-uris': 'http://example.com,http://example2.com/.*,~https://example2.com/.*'
    })

    await getOpenIdUrl(openIdLoginUrl, 'http://example.com', HttpStatusCode.FOUND_302)
    await getOpenIdUrl(openIdLoginUrl, 'http://example.com/2', HttpStatusCode.FORBIDDEN_403)

    await getOpenIdUrl(openIdLoginUrl, 'http://example2.com/2', HttpStatusCode.FORBIDDEN_403)

    await getOpenIdUrl(openIdLoginUrl, 'http://example2.com/2', HttpStatusCode.FORBIDDEN_403)
    await getOpenIdUrl(openIdLoginUrl, 'https://example2.com/2', HttpStatusCode.FOUND_302)
  })

  it('Should correctly redirect the user', async function () {
    const peertubeRes = await getOpenIdUrl(openIdLoginUrl, 'http://example.com')
    const kcRes = await loginOnKeycloak({ loginPageUrl: extractLocation(peertubeRes) })

    const ptBypassPath = await sendBackKeycloakCode({ peertubeRes, kcRes, redirectUrl: 'http://example.com', success: true })
    const externalAuthToken = new URL(ptBypassPath, server.url).searchParams.get('externalAuthToken')

    const { body } = await server.login.loginUsingExternalToken({ username: 'myuser_example.com', externalAuthToken })
    expect(body.access_token).to.exist
  })

  it('Should not allow a redirect URL if not provided in the settings', async function () {
    for (const value of [ null, '', undefined ]) {
      await updatePluginSettings(server, {
        'allowed-external-redirect-uris': value
      })

      await getOpenIdUrl(openIdLoginUrl, 'https://example2.com', HttpStatusCode.FORBIDDEN_403)
      await getOpenIdUrl(openIdLoginUrl, '', HttpStatusCode.FORBIDDEN_403)
    }
  })

  it('Should only login allowed groups', async function () {
    {
      await updatePluginSettings(server, {
        'group-property': 'typo',
        'allowed-group': 'Group1'
      })

      const peertubeRes = await getOpenIdUrl(openIdLoginUrl)
      const kcRes = await loginOnKeycloak({ loginPageUrl: extractLocation(peertubeRes), username: 'user_group1' })
      const redirectUrl = await sendBackKeycloakCode({ peertubeRes, kcRes, success: false })
      expect(redirectUrl).to.equal('/login?externalAuthError=true')
    }

    {
      await updatePluginSettings(server, {
        'group-property': 'groups',
        'allowed-group': 'Group 1'
      })

      const peertubeRes = await getOpenIdUrl(openIdLoginUrl)
      const kcRes = await loginOnKeycloak({ loginPageUrl: extractLocation(peertubeRes), username: 'user_group1' })
      await sendBackKeycloakCode({ peertubeRes, kcRes, username: 'user_group1_example.com', success: true })
    }

    {
      await updatePluginSettings(server, {
        'group-property': 'groups',
        'allowed-group': 'Group 2'
      })

      const peertubeRes = await getOpenIdUrl(openIdLoginUrl)
      const kcRes = await loginOnKeycloak({ loginPageUrl: extractLocation(peertubeRes), username: 'user_group1' })
      const redirectUrl = await sendBackKeycloakCode({ peertubeRes, kcRes, success: false })
      expect(redirectUrl).to.equal('/login?externalAuthError=true')
    }
  })

  it('Should correctly map the user role property', async function () {
    await updatePluginSettings(server, { 'role-property': 'role' })

    {
      const peertubeRes = await getOpenIdUrl(openIdLoginUrl)
      const kcRes = await loginOnKeycloak({ loginPageUrl: extractLocation(peertubeRes), username: 'moderator' })
      const ptBypassPath = await sendBackKeycloakCode({ peertubeRes, kcRes, username: 'moderator_example.com', success: true })

      const externalAuthToken = new URL(ptBypassPath, server.url).searchParams.get('externalAuthToken')

      const { body } = await server.login.loginUsingExternalToken({ username: 'moderator_example.com', externalAuthToken })
      const me = await server.users.getMyInfo({ token: body.access_token })
      expect(me.role.id).to.equal(UserRole.MODERATOR)
    }

    {
      const peertubeRes = await getOpenIdUrl(openIdLoginUrl)
      const kcRes = await loginOnKeycloak({ loginPageUrl: extractLocation(peertubeRes), username: 'user_group2' })
      const ptBypassPath = await sendBackKeycloakCode({ peertubeRes, kcRes, username: 'user_group2_example.com', success: true })

      const externalAuthToken = new URL(ptBypassPath, server.url).searchParams.get('externalAuthToken')

      const { body } = await server.login.loginUsingExternalToken({ username: 'user_group2_example.com', externalAuthToken })
      const me = await server.users.getMyInfo({ token: body.access_token })
      expect(me.role.id).to.equal(UserRole.USER)
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})

function extractActionUrl (text: string) {
  const matched = text.match(/<form[^>]+action="([^"]+)"/i)

  if (!matched) {
    console.error(text)
    throw new Error('Cannot find action URL in the login page')
  }

  return matched[1].replace(/&amp;/g, '&')
}

function extractInputValue (text: string, name: string) {
  const match = text.match(new RegExp(`<input[^>]+name="${name}"[^>]+value="([^"]+)"`, 'i'))

  return match[1]
}

async function getOpenIdUrl (
  openIdLoginUrl: string,
  externalRedirectUri?: string,
  expectedStatus: HttpStatusCodeType = HttpStatusCode.FOUND_302
) {
  const query = externalRedirectUri !== undefined
    ? { externalRedirectUri }
    : undefined

  const peertubeRes = await makeRawRequest({
    url: openIdLoginUrl,
    query,
    expectedStatus
  })

  const kcLocation = peertubeRes.headers['location']
  if (expectedStatus !== HttpStatusCode.FOUND_302) {
    expect(kcLocation).to.be.undefined

    return peertubeRes
  }

  expect(kcLocation).to.include(`http://${oauthServerHost}:${oauthServerPort}/realms/myrealm/protocol/openid-connect/auth?`)

  const parsed = new URL(kcLocation)
  expect(parsed.searchParams.get('client_id')).to.equal('myclient')
  expect(parsed.searchParams.get('scope')).to.equal('openid email profile')
  expect(parsed.searchParams.get('response_type')).to.equal('code')

  return peertubeRes
}

async function loginOnKeycloak (options: {
  loginPageUrl: string
  username?: string
  password?: string
}) {
  const { loginPageUrl, username = 'myuser', password = 'coucou' } = options

  const resLoginPage = await makeRawRequest({ url: loginPageUrl, expectedStatus: HttpStatusCode.OK_200 })
  expect(resLoginPage.text).to.include('Sign in to your account')

  const cookies = extractCookies(resLoginPage)
  const actionUrl = extractActionUrl(resLoginPage.text)

  const res = await makeRawRequest({
    url: actionUrl,
    method: 'POST',
    requestType: 'form',
    fields: { username, password },
    headers: {
      Cookie: cookies
    },
    expectedStatus: HttpStatusCode.OK_200
  })

  return res
}

async function sendBackKeycloakCode (options: {
  peertubeRes: Response
  kcRes: Response
  success: boolean
  redirectUrl?: string
  username?: string
}) {
  const { peertubeRes, kcRes, redirectUrl = '/login', success, username = 'myuser_example.com' } = options

  const kcText = kcRes.text

  const res = await makeRawRequest({
    url: extractActionUrl(kcText),
    method: 'POST',
    headers: {
      'Cookie': extractCookies(peertubeRes),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    fields: {
      code: extractInputValue(kcText, 'code'),
      iss: extractInputValue(kcText, 'iss'),
      state: extractInputValue(kcText, 'state'),
      session_state: extractInputValue(kcText, 'session_state')
    },
    expectedStatus: HttpStatusCode.FOUND_302
  })

  const ptBypassPath = res.headers['location']

  if (success) {
    expect(ptBypassPath).to.include(redirectUrl)
    expect(ptBypassPath).to.include('?externalAuthToken=')
    expect(ptBypassPath).to.include('username=' + username)
  }

  return ptBypassPath
}

function extractCookies (res: Response) {
  return res.get('Set-Cookie').join('; ')
}

function extractLocation (res: Response) {
  const location = res.headers['location']
  if (!location) throw new Error('No location header found in response')

  return location
}

async function waitForAuthReady (server: PeerTubeServer) {
  let config = await server.config.getConfig()

  while (config.plugin.registeredExternalAuths.length === 0) {
    await wait(500)

    config = await server.config.getConfig()
  }

  return config
}

async function updatePluginSettings (server: PeerTubeServer, override?: Record<string, any>) {
  const pluginSettings = {
    'auth-display-name': 'OpenID Connect',
    'discover-url': `http://${oauthServerHost}:${oauthServerPort}/realms/myrealm`,
    'client-id': 'myclient',
    'client-secret': 'D9MdqzGSnlfWJq00e9mBzI31OPn9WXyg',
    'scope': 'openid email profile',
    'username-property': 'email',
    'mail-property': 'email',
    'logout-redirect-uri': '',
    'display-name-property': 'email',
    'role-property': '',
    'group-property': '',
    'allowed-group': '',
    'signature-algorithm': 'RS256'
  }

  await server.plugins.updateSettings({
    npmName: 'peertube-plugin-auth-openid-connect',
    settings: {
      ...pluginSettings,

      ...override
    }
  })

  return waitForAuthReady(server)
}
