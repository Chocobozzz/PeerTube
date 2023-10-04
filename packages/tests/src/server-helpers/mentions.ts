/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { extractMentions } from '@peertube/peertube-server/core/helpers/mentions.js'

describe('Comment model', function () {
  it('Should correctly extract mentions', async function () {
    const text = '@florian @jean@localhost:9000 @flo @another@localhost:9000 @flo2@jean.com hello ' +
      'email@localhost:9000 coucou.com no? @chocobozzz @chocobozzz @end'

    const isOwned = true

    const result = extractMentions(text, isOwned).sort((a, b) => a.localeCompare(b))

    expect(result).to.deep.equal([ 'another', 'chocobozzz', 'end', 'flo', 'florian', 'jean' ])
  })
})
