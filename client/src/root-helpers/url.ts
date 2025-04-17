export function getParamToggle (params: URLSearchParams, name: string, defaultValue?: boolean) {
  return params.has(name)
    ? (params.get(name) === '1' || params.get(name) === 'true')
    : defaultValue
}

export function getParamString (params: URLSearchParams, name: string, defaultValue?: string) {
  return params.has(name)
    ? params.get(name)
    : defaultValue
}

export function objectToUrlEncoded (obj: any) {
  const str: string[] = []
  for (const key of Object.keys(obj)) {
    str.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]))
  }

  return str.join('&')
}

export function isSameOrigin (current: string, target: string) {
  const currentUrl = new URL(current)
  const targetUrl = new URL(target)

  if (currentUrl.hostname === 'localhost' && targetUrl.hostname === 'localhost') return true

  return currentUrl.origin === targetUrl.origin
}
