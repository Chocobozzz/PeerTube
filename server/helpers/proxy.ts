function getProxy () {
  return process.env.HTTPS_PROXY ||
         process.env.HTTP_PROXY ||
         undefined
}

function isProxyEnabled () {
  return !!getProxy()
}

export {
  getProxy,
  isProxyEnabled
}
