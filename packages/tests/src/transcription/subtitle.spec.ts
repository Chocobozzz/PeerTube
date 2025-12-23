import { srtToTxt } from '@peertube/peertube-transcription'
import { expect } from 'chai'

describe('srt to txt', function () {
  it(`Transforms the content of a srt subtitle to a pure text version`, function () {
    const txt = srtToTxt(`1
00:00:00,000 --> 00:00:01,940
December, 1965.

2
00:00:03,460 --> 00:00:06,660
Is that all it has been since
I inherited the world?

3
00:00:07,020 --> 00:00:08,900
Only three years.

4
00:00:09,940 --> 00:00:11,760
Seems like a hundred million.

`)

    expect(txt).equals(`December, 1965.
Is that all it has been since
I inherited the world?
Only three years.
Seems like a hundred million.

`)
  })
})
