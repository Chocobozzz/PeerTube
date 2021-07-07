/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { ServerInfo } from '../server/servers'

async function testHelloWorldRegisteredSettings (server: ServerInfo) {
  const body = await server.pluginsCommand.getRegisteredSettings({ npmName: 'peertube-plugin-hello-world' })

  const registeredSettings = body.registeredSettings
  expect(registeredSettings).to.have.length.at.least(1)

  const adminNameSettings = registeredSettings.find(s => s.name === 'admin-name')
  expect(adminNameSettings).to.not.be.undefined
}

export {
  testHelloWorldRegisteredSettings
}
