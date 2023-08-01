// SPDX-FileCopyrightText: 2023 PeerTube contributors <https://joinpeertube.org/>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

function getBoolOrDefault (value: string, defaultValue: boolean) {
  if (value === 'true') return true
  if (value === 'false') return false

  return defaultValue
}

export {
  getBoolOrDefault
}
