import { levenshteinDistance } from '@peertube/peertube-transcription-devtools'
import { expect } from 'chai'

describe('Levenshtein distance', function () {
  it(`equals 1 when there is only one character difference`, function () {
    expect(levenshteinDistance('abcd', 'abce')).equals(1)
  })

  it(`may calculate a distance on a txt subtitle content `, function () {
    expect(levenshteinDistance(`December, 1965.
Is that all it has been since
I inherited the world?
Only three years.
Seems like a hundred million.

`, 'December 1965, is that all it has been since I inherited the world only three years, seems like a hundred million.')).equals(13)
  })
})
