export function getProxy () {
  return process.env.HTTPS_PROXY ||
         process.env.HTTP_PROXY ||
         undefined
}

export function isProxyEnabled () {
  return !!getProxy()
}
