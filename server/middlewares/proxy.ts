const envs = require("env-smart")
// read environment variable
const OS_HTTP_PROXY = envs.load().HTTP_PROXY
const OS_HTTPS_PROXY = envs.load().HTTPS_PROXY
const proxy = () => {
  let proxyAddress = null
  /* istanbul ignore else */
  if (typeof OS_HTTPS_PROXY !== "undefined") {
    console.log("OS HTTPS_PROXY Environment variable :", `${OS_HTTPS_PROXY}`)
    proxyAddress = OS_HTTPS_PROXY
  }
  /* istanbul ignore else */
  if (typeof OS_HTTP_PROXY !== "undefined") {
    console.log("OS HTTP_PROXY Environment variable :", `${OS_HTTP_PROXY}`)
    proxyAddress = OS_HTTP_PROXY
  }
  return proxyAddress
}
module.exports = proxy
