// SPDX-FileCopyrightText: 2023 PeerTube contributors <https://joinpeertube.org/>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

function capitalizeFirstLetter (str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export {
  capitalizeFirstLetter
}
