// SPDX-FileCopyrightText: 2023 PeerTube contributors <https://joinpeertube.org/>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

function getParamToggle (params: URLSearchParams, name: string, defaultValue?: boolean) {
  return params.has(name)
    ? (params.get(name) === '1' || params.get(name) === 'true')
    : defaultValue
}

function getParamString (params: URLSearchParams, name: string, defaultValue?: string) {
  return params.has(name)
    ? params.get(name)
    : defaultValue
}

function objectToUrlEncoded (obj: any) {
  const str: string[] = []
  for (const key of Object.keys(obj)) {
    str.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]))
  }

  return str.join('&')
}

export {
  getParamToggle,
  getParamString,
  objectToUrlEncoded
}
