/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { pathExists, remove } from 'fs-extra/esm'
import { join } from 'path'
import { wait } from '@peertube/peertube-core-utils'
import { root } from '@peertube/peertube-node-utils'
import { doRequest, doRequestAndSaveToFile } from '@peertube/peertube-server/core/helpers/requests.js'
import { Mock429 } from '@tests/shared/mock-servers/mock-429.js'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'

describe('Request helpers', function () {
  const destPath1 = join(root(), 'test-output-1.txt')
  const destPath2 = join(root(), 'test-output-2.txt')

  it('Should throw an error when the bytes limit is exceeded for request', async function () {
    try {
      await doRequest(FIXTURE_URLS.file4K, { bodyKBLimit: 3 })
    } catch {
      return
    }

    throw new Error('No error thrown by do request')
  })

  it('Should throw an error when the bytes limit is exceeded for request and save file', async function () {
    try {
      await doRequestAndSaveToFile(FIXTURE_URLS.file4K, destPath1, { bodyKBLimit: 3 })
    } catch {

      await wait(500)
      expect(await pathExists(destPath1)).to.be.false
      return
    }

    throw new Error('No error thrown by do request and save to file')
  })

  it('Should correctly retry on 429 error', async function () {
    this.timeout(25000)

    const mock = new Mock429()
    const port = await mock.initialize()

    const before = new Date().getTime()
    await doRequest('http://127.0.0.1:' + port, { preventSSRF: false })

    expect(new Date().getTime() - before).to.be.greaterThan(2000)

    await mock.terminate()
  })

  it('Should succeed if the file is below the limit', async function () {
    await doRequest(FIXTURE_URLS.file4K, { bodyKBLimit: 5 })
    await doRequestAndSaveToFile(FIXTURE_URLS.file4K, destPath2, { bodyKBLimit: 5 })

    expect(await pathExists(destPath2)).to.be.true
  })

  after(async function () {
    await remove(destPath1)
    await remove(destPath2)
  })
})
