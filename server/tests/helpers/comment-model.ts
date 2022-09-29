/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { VideoCommentModel } from '../../models/video/video-comment'

class CommentMock {
  text: string

  extractMentions = VideoCommentModel.prototype.extractMentions

  isOwned = () => true
}

describe('Comment model', function () {
  it('Should correctly extract mentions', async function () {
    const comment = new CommentMock()

    comment.text = '@florian @jean@localhost:9000 @flo @another@localhost:9000 @flo2@jean.com hello ' +
      'email@localhost:9000 coucou.com no? @chocobozzz @chocobozzz @end'
    const result = comment.extractMentions().sort((a, b) => a.localeCompare(b))

    expect(result).to.deep.equal([ 'another', 'chocobozzz', 'end', 'flo', 'florian', 'jean' ])
  })
})
