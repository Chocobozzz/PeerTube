/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { mdToOneLinePlainText } from '@peertube/peertube-server/server/helpers/markdown.js'
import { expect } from 'chai'

describe('Markdown helpers', function () {

  describe('Plain text', function () {

    it('Should convert a list to plain text', function () {
      const result = mdToOneLinePlainText(`* list 1
* list 2
* list 3`)

      expect(result).to.equal('list 1, list 2, list 3')
    })

    it('Should convert a list with indentation to plain text', function () {
      const result = mdToOneLinePlainText(`Hello:
  * list 1
  * list 2
  * list 3`)

      expect(result).to.equal('Hello: list 1, list 2, list 3')
    })

    it('Should convert HTML to plain text', function () {
      const result = mdToOneLinePlainText(`**Hello** <strong>coucou</strong>`)

      expect(result).to.equal('Hello coucou')
    })

    it('Should convert tags to plain text', function () {
      const result = mdToOneLinePlainText(`#déconversion\n#newage\n#histoire`)

      expect(result).to.equal('#déconversion #newage #histoire')
    })
  })
})
