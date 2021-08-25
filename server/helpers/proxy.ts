import { logger } from "./logger"

// read environment variable
const OS_HTTP_PROXY = process.env.HTTP_PROXY
const OS_HTTPS_PROXY = process.env.HTTPS_PROXY
function getProxy() {
  let proxyAddress
  /* istanbul ignore else */
  if (typeof OS_HTTPS_PROXY !== "undefined") {
    logger.debug("Using OS HTTPS_PROXY Environment variable.")
    proxyAddress = OS_HTTPS_PROXY
  }
  /* istanbul ignore else */
  if (typeof OS_HTTP_PROXY !== "undefined") {
    logger.debug("Using OS HTTP_PROXY Environment variable.")
    proxyAddress = OS_HTTP_PROXY
  }
  return proxyAddress
}
module.exports = getProxy
