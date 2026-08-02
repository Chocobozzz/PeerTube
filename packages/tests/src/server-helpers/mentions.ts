/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { extractLocalMentions } from '@peertube/peertube-server/core/helpers/mentions.js'

describe('Comment model', function () {
  it('Should correctly extract mentions', async function () {
    const text = '@florian @jean@localhost:9000 @flo @another@localhost:9000 @flo2@jean.com hello ' +
      'email@localhost:9000 coucou.com no? @chocobozzz @chocobozzz @end'

    const isLocal = true

    const result = extractLocalMentions(text, isLocal)

    expect(result).to.deep.equal([ 'florian', 'jean', 'flo', 'another', 'chocobozzz', 'end' ])
  })

  it('Should correctly extract mentions with adjacent punctuations and newlines', async function () {
    expect(extractLocalMentions('thanks @bob!', true)).to.deep.equal([ 'bob' ])
    expect(extractLocalMentions('@bob\n', true)).to.deep.equal([ 'bob' ])
  })
})
