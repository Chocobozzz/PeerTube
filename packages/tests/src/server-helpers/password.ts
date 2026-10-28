/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import { isUserPasswordTooLong, isUserPasswordValid } from '@peertube/peertube-server/core/helpers/custom-validators/users.js'
import { comparePassword, cryptPassword } from '@peertube/peertube-server/core/helpers/peertube-crypto.js'
import { ADMIN_MEMORABLE_PASSWORD_GENERATION_LENGTH } from '@peertube/peertube-server/core/initializers/constants.js'
import { expect } from 'chai'
import { generatePassword } from 'password-generator'

describe('Password generation', function () {
  it('Should correctly generate a password', async function () {
    const password = await generatePassword(ADMIN_MEMORABLE_PASSWORD_GENERATION_LENGTH, true)

    expect(password).to.have.lengthOf(20)
  })
})

describe('Password length validation', function () {
  it('Should accept a password within bounds', function () {
    expect(isUserPasswordValid('a'.repeat(10))).to.be.true
    expect(isUserPasswordTooLong('a'.repeat(10))).to.be.false
  })

  it('Should reject a password over 50 characters', function () {
    const password = 'a'.repeat(51)

    expect(isUserPasswordTooLong(password)).to.be.true
    expect(isUserPasswordValid(password)).to.be.false
  })

  it('Should reject a password over 72 bytes even if under 50 characters', function () {
    // '中' is a single UTF-16 code unit but 3 bytes in UTF-8: 25 chars, 75 bytes
    const password = '中'.repeat(25)

    expect(password).to.have.lengthOf(25)
    expect(Buffer.byteLength(password, 'utf8')).to.be.greaterThan(72)
    expect(isUserPasswordTooLong(password)).to.be.true
  })
})

describe('comparePassword refuses more than 72 bytes', function () {
  // peertube-crypto.comparePassword has its own guard that throws above 72 bytes, instead of
  // calling into bcrypt (which would otherwise silently truncate and compare only the first 72
  // bytes of its input). This is what actually prevents a bcrypt truncation collision in
  // PeerTube, independently of where isUserPasswordTooLong runs. Pin it down so a refactor that
  // drops this guard fails here instead of silently in production.
  const basePassword = 'C'.repeat(72)
  let hash: string

  before(async function () {
    this.timeout(10000)

    hash = await cryptPassword(basePassword)
  })

  it('Should match the exact 72 bytes password', async function () {
    expect(await comparePassword(basePassword, hash)).to.be.true
  })

  it('Should refuse to compare a password one byte over the limit, not silently truncate it', async function () {
    await expectRejection(() => comparePassword(basePassword + 'D', hash))
  })

  it('Should refuse to compare a much longer password the same way', async function () {
    await expectRejection(() => comparePassword(basePassword + 'D'.repeat(200), hash))
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
