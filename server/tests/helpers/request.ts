/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { doRequest, doRequestAndSaveToFile } from '../../helpers/requests'
import { get4KFileUrl, root, wait } from '../../../shared/extra-utils'
import { join } from 'path'
import { pathExists, remove } from 'fs-extra'
import { expect } from 'chai'

describe('Request helpers', function () {
  const destPath1 = join(root(), 'test-output-1.txt')
  const destPath2 = join(root(), 'test-output-2.txt')

  it('Should throw an error when the bytes limit is exceeded for request', async function () {
    try {
      await doRequest({ uri: get4KFileUrl() }, 3)
    } catch {
      return
    }

    throw new Error('No error thrown by do request')
  })

  it('Should throw an error when the bytes limit is exceeded for request and save file', async function () {
    try {
      await doRequestAndSaveToFile({ uri: get4KFileUrl() }, destPath1, 3)
    } catch {

      await wait(500)
      expect(await pathExists(destPath1)).to.be.false
      return
    }

    throw new Error('No error thrown by do request and save to file')
  })

  it('Should succeed if the file is below the limit', async function () {
    await doRequest({ uri: get4KFileUrl() }, 5)
    await doRequestAndSaveToFile({ uri: get4KFileUrl() }, destPath2, 5)

    expect(await pathExists(destPath2)).to.be.true
  })

  after(async function () {
    await remove(destPath1)
    await remove(destPath2)
  })
})
