/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, HttpStatusCodeType } from '@peertube/peertube-models'
import { decodeQueryString, PeerTubeServer } from '@peertube/peertube-server-commands'
import { expect } from 'chai'

export async function testHelloWorldRegisteredSettings (server: PeerTubeServer) {
  const body = await server.plugins.getRegisteredSettings({ npmName: 'peertube-plugin-hello-world' })

  const registeredSettings = body.registeredSettings
  expect(registeredSettings).to.have.length.at.least(1)

  const adminNameSettings = registeredSettings.find(s => s.name === 'admin-name')
  expect(adminNameSettings).to.not.be.undefined
}

export async function loginExternal (options: {
  server: PeerTubeServer
  npmName: string
  authName: string
  username: string
  query?: any
  expectedStatus?: HttpStatusCodeType
  expectedStatusStep2?: HttpStatusCodeType
}) {
  const externalAuthToken = await fetchExternalToken(options)
  if (!externalAuthToken) return

  const resLogin = await options.server.login.loginUsingExternalToken({
    username: options.username,
    externalAuthToken,
    expectedStatus: options.expectedStatusStep2
  })

  return resLogin.body
}

export async function fetchExternalToken (options: {
  server: PeerTubeServer
  npmName: string
  authName: string
  query?: Record<string, string>
  expectedStatus?: HttpStatusCodeType
}) {
  const res = await options.server.plugins.getExternalAuth({
    npmName: options.npmName,
    npmVersion: '0.0.1',
    authName: options.authName,
    query: options.query,
    expectedStatus: options.expectedStatus || HttpStatusCode.FOUND_302
  })

  if (res.status !== HttpStatusCode.FOUND_302) return undefined

  const location = res.header.location
  const { externalAuthToken } = decodeQueryString(location)

  return externalAuthToken as string
}
