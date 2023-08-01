// SPDX-FileCopyrightText: 2023 PeerTube contributors <https://joinpeertube.org/>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { logger } from './logger'

function imageToDataURL (input: File | Blob) {
  return new Promise<string>(res => {
    const reader = new FileReader()

    reader.onerror = err => logger.error('Cannot read input file.', err)
    reader.onloadend = () => res(reader.result as string)
    reader.readAsDataURL(input)
  })
}

export {
  imageToDataURL
}
