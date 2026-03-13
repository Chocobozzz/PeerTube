/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import { ADMIN_MEMORABLE_PASSWORD_GENERATION_LENGTH } from '@peertube/peertube-server/core/initializers/constants.js'
import { expect } from 'chai'
import { generatePassword } from 'password-generator'

describe('Password generation', function () {
  it('Should correctly generate a password', async function () {
    const password = await generatePassword(ADMIN_MEMORABLE_PASSWORD_GENERATION_LENGTH, true)

    expect(password).to.have.lengthOf(20)
  })
})
