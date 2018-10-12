/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  parseBytes
} from '../../helpers/core-utils'

const expect = chai.expect

describe('Parse Bytes', function () {
  it('Should pass when given valid value', async function () {
    // just return it
    expect(parseBytes(1024)).to.be.eq(1024)
    expect(parseBytes(1048576)).to.be.eq(1048576)
    expect(parseBytes('1024')).to.be.eq(1024)
    expect(parseBytes('1048576')).to.be.eq(1048576)

    // sizes
    expect(parseBytes('1B')).to.be.eq(1024)
    expect(parseBytes('1MB')).to.be.eq(1048576)
    expect(parseBytes('1GB')).to.be.eq(1073741824)
    expect(parseBytes('1TB')).to.be.eq(1099511627776)

    expect(parseBytes('5GB')).to.be.eq(5368709120)
    expect(parseBytes('5TB')).to.be.eq(5497558138880)

    expect(parseBytes('1024B')).to.be.eq(1048576)
    expect(parseBytes('1024MB')).to.be.eq(1073741824)
    expect(parseBytes('1024GB')).to.be.eq(1099511627776)
    expect(parseBytes('1024TB')).to.be.eq(1125899906842624)

    // with whitespace
    expect(parseBytes('1 GB')).to.be.eq(1073741824)
    expect(parseBytes('1\tGB')).to.be.eq(1073741824)

    // sum value
    expect(parseBytes('1TB 1024MB')).to.be.eq(1100585369600)
    expect(parseBytes('4GB 1024MB')).to.be.eq(5368709120)
    expect(parseBytes('4TB 1024GB')).to.be.eq(5497558138880)
    expect(parseBytes('4TB 1024GB 0MB')).to.be.eq(5497558138880)
    expect(parseBytes('1024TB 1024GB 1024MB')).to.be.eq(1127000492212224)
  })

  it('Should be invalid when given invalid value', async function () {
    expect(parseBytes('6GB 1GB')).to.be.eq(6)
  })
})
