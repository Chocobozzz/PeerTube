/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import { snakeCase } from 'lodash'
import { objectConverter, parseBytes } from '../../helpers/core-utils'
import validator from 'validator'

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

  it('Should convert an object', async function () {
    function keyConverter (k: string) {
      return snakeCase(k)
    }

    function valueConverter (v: any) {
      if (validator.isNumeric(v + '')) return parseInt('' + v, 10)

      return v
    }

    const obj = {
      mySuperKey: 'hello',
      mySuper2Key: '45',
      mySuper3Key: {
        mySuperSubKey: '15',
        mySuperSub2Key: 'hello',
        mySuperSub3Key: [ '1', 'hello', 2 ],
        mySuperSub4Key: 4
      },
      mySuper4Key: 45,
      toto: {
        super_key: '15',
        superKey2: 'hello'
      },
      super_key: {
        superKey4: 15
      }
    }

    const res = objectConverter(obj, keyConverter, valueConverter)

    expect(res.my_super_key).to.equal('hello')
    expect(res.my_super_2_key).to.equal(45)
    expect(res.my_super_3_key.my_super_sub_key).to.equal(15)
    expect(res.my_super_3_key.my_super_sub_2_key).to.equal('hello')
    expect(res.my_super_3_key.my_super_sub_3_key).to.deep.equal([ 1, 'hello', 2 ])
    expect(res.my_super_3_key.my_super_sub_4_key).to.equal(4)
    expect(res.toto.super_key).to.equal(15)
    expect(res.toto.super_key_2).to.equal('hello')
    expect(res.super_key.super_key_4).to.equal(15)

    // Immutable
    expect(res.mySuperKey).to.be.undefined
    expect(obj['my_super_key']).to.be.undefined
  })
})
