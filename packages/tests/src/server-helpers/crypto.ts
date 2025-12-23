/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { decrypt, encrypt } from '@peertube/peertube-server/core/helpers/peertube-crypto.js'

describe('Encrypt/Descrypt', function () {

  it('Should encrypt and decrypt the string', async function () {
    const secret = 'my_secret'
    const str = 'my super string'

    const encrypted = await encrypt(str, secret)
    const decrypted = await decrypt(encrypted, secret)

    expect(str).to.equal(decrypted)
  })

  it('Should not decrypt without the same secret', async function () {
    const str = 'my super string'

    const encrypted = await encrypt(str, 'my_secret')

    let decrypted = ''

    try {
      decrypted = await decrypt(encrypted, 'my_sicret')
    } catch { }

    expect(decrypted).to.not.equal(encrypted)
  })
})
