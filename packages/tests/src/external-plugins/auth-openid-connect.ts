/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
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

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    await server.plugins.install({ npmName: 'peertube-plugin-auth-openid-connect' })
    await server.plugins.updateSettings({
      npmName: 'peertube-plugin-auth-openid-connect',
      settings: pluginSettings
    })
  })

  it('Should load openid connect plugin', async function () {
    const config = await server.config.getConfig()
    const { name, version, authName } = config.plugin.registeredExternalAuths[0]
    openIdLoginUrl = server.url + `/plugins/${name}/${version}/auth/${authName}`
  })

  it('Should login with the appropriate username/password', async function () {
    const peertubeRes = await getOpenIdUrl(openIdLoginUrl)
    const kcRes = await loginOnKeycloak(extractLocation(peertubeRes))

    const ptBypassPath = await sendBackKeycloakCode(peertubeRes, kcRes)
    const externalAuthToken = new URL(ptBypassPath, server.url).searchParams.get('externalAuthToken')

    const { body } = await server.login.loginUsingExternalToken({ username: 'myuser_example.com', externalAuthToken })

    const { username } = await server.users.getMyInfo({ token: body.access_token })
    expect(username).to.equal('myuser_example.com')
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

async function getOpenIdUrl (openIdLoginUrl: string) {
  const peertubeRes = await makeRawRequest({ url: openIdLoginUrl, expectedStatus: HttpStatusCode.FOUND_302 })

  const kcLocation = peertubeRes.headers['location']
  expect(kcLocation).to.include(`http://${oauthServerHost}:${oauthServerPort}/realms/myrealm/protocol/openid-connect/auth?`)

  const parsed = new URL(kcLocation)
  expect(parsed.searchParams.get('client_id')).to.equal('myclient')
  expect(parsed.searchParams.get('scope')).to.equal('openid email profile')
  expect(parsed.searchParams.get('response_type')).to.equal('code')

  return peertubeRes
}

async function loginOnKeycloak (loginPageUrl: string) {
  const resLoginPage = await makeRawRequest({ url: loginPageUrl, expectedStatus: HttpStatusCode.OK_200 })
  expect(resLoginPage.text).to.include('Sign in to your account')

  const cookies = extractCookies(resLoginPage)
  const actionUrl = extractActionUrl(resLoginPage.text)

  const res = await makeRawRequest({
    url: actionUrl,
    method: 'POST',
    requestType: 'form',
    fields: {
      username: 'myuser',
      password: 'coucou'
    },
    headers: {
      Cookie: cookies
    },
    expectedStatus: HttpStatusCode.OK_200
  })

  return res
}

async function sendBackKeycloakCode (peertubeRes: Response, kcRes: Response) {
  const kcText = kcRes.text

  const res = await makeRawRequest({
    url: extractActionUrl(kcText),
    method: 'POST',
    headers: {
      Cookie: extractCookies(peertubeRes)
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
  expect(ptBypassPath).to.include('/login?externalAuthToken=')
  expect(ptBypassPath).to.include('username=myuser_example.com')

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
