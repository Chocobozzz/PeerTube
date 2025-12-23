/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wordsToRegExp } from '@peertube/peertube-server/core/helpers/regexp.js'
import { expect } from 'chai'

describe('Regexp', function () {

  it('Should correctly create a regex from multiple latin words', function () {
    const regexp = wordsToRegExp([ 'hi', 'toto ', 'hello picsou' ])

    expect('hi').to.match(regexp)
    expect('coucou toto').to.match(regexp)
    expect('coucou toto').to.match(regexp)

    expect('coucoutoto').to.not.match(regexp)

    expect('coucoutoto hello coucou').to.not.match(regexp)

    expect('coucoutoto hello picsou hello').to.match(regexp)
    expect('coucoutoto hello picsou').to.match(regexp)
  })

  it('Should correctly create a regex from non latin words', function () {
    const regexp = wordsToRegExp([ '🇫🇷', '🇨🇦 hi' ])

    expect('🇫🇷').to.match(regexp)
    expect(' 🇫🇷 ').to.match(regexp)
    expect('coucou 🇫🇷 toto').to.match(regexp)
    expect('hello 🇨🇦 hi toto').to.match(regexp)
    expect('hello 🇨🇦 hi').to.match(regexp)
    expect('🇨🇦 hi').to.match(regexp)
    expect('🇫🇷🇨🇦 hi').to.match(regexp)

    expect('coucou 🇫🇷toto').to.not.match(regexp)
    expect('e🇨🇦 hi').to.not.match(regexp)
    expect('hello 🇨🇦 toto').to.not.match(regexp)
  })

  it('Should correctly create a regex from single word', function () {
    const regexp = wordsToRegExp([ 'hi my friend' ])

    expect('hi').to.not.match(regexp)
    expect('hi my friend').to.match(regexp)
    expect(' hi my friend ').to.match(regexp)

    expect(' hi my friendy ').to.not.match(regexp)
  })

  it('Should correctly escape words to regex', function () {
    const regexp = wordsToRegExp([ 'hi[hello]', 'toto. ', 'coucou+' ])

    expect('1 2 toto. 3').to.match(regexp)
    expect('hi[hello]').to.match(regexp)
    expect(' coucou coucou+').to.match(regexp)

    expect('hihello').to.not.match(regexp)
    expect('totoa').to.not.match(regexp)
    expect('1 2 toto 3').to.not.match(regexp)
  })
})
