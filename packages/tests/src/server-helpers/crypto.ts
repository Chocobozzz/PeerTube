/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { decrypt, encrypt } from '@peertube/peertube-server/core/helpers/peertube-crypto.js'
import { expect } from 'chai'

describe('Encrypt/Descrypt', function () {
  const secret = 'my_secret'
  const str = 'my super string'

  it('Should encrypt and decrypt the string', async function () {
    const encrypted = await encrypt(str, secret)
    const decrypted = await decrypt(encrypted, secret)

    expect(decrypted).to.equal(str)
  })

  it('Should emit GCM format (salt:iv:authTag:ciphertext)', async function () {
    const encrypted = await encrypt(str, secret)

    expect(encrypted.split(':')).to.have.lengthOf(4)
  })

  it('Should not decrypt with a wrong secret', async function () {
    const encrypted = await encrypt(str, secret)

    await expectRejection(() => decrypt(encrypted, 'my_sicret'))
  })

  it('Should detect a tampered ciphertext', async function () {
    const encrypted = await encrypt(str, secret)

    const parts = encrypted.split(':')
    // Flip the last byte of the ciphertext segment
    const ciphertext = parts[3]
    const lastByte = parseInt(ciphertext.slice(-2), 16) ^ 0xff
    parts[3] = ciphertext.slice(0, -2) + lastByte.toString(16).padStart(2, '0')

    await expectRejection(() => decrypt(parts.join(':'), secret))
  })

  it('Should reject a truncated auth tag', async function () {
    const encrypted = await encrypt(str, secret)

    const parts = encrypted.split(':')
    // Shorten the auth tag segment (parts[2]) from 16 to 4 bytes: a shorter tag weakens forgery resistance
    parts[2] = parts[2].slice(0, 8)

    await expectRejection(() => decrypt(parts.join(':'), secret))
  })

  it('Should reject an unrecognized (non-GCM) format', async function () {
    // A pre-GCM 2-part CBC value: no longer decryptable (migrated to GCM at boot by 1090-otp-secret-gcm)
    const legacy = 'd49a7eafe7f4c39960a562672a3d6304:3be751a9187979523ea87bff3467a016e6a73ad36a513f7ce4719e963a3a29f3'

    await expectRejection(() => decrypt(legacy, 'my_secret'))
  })
})

async function expectRejection (fn: () => Promise<any>) {
  let thrown = false

  try {
    await fn()
  } catch {
    thrown = true
  }

  expect(thrown, 'expected the promise to reject').to.be.true
}
