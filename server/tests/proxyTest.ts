const expect = require("chai").expect
const assert = require("chai").assert
const proxyTest = require("../middlewares/proxy")
const envse = require("env-smart")
// read environment variable
const httpProxy = envse.load().HTTP_PROXY
const httpsProxy = envse.load().HTTPS_PROXY
describe("The Proxy function with HTTP_PROXY or HTTPS_PROXY", function () {
  if (proxyTest()) {
    if (typeof httpsProxy || typeof httpProxy !== "undefined") {
      it("value from proxy is not null", function () {
        const result = proxyTest()
        expect(result).to.equal(httpProxy || httpsProxy)
      })
      it("value from proxy is not undefined", function () {
        const result = proxyTest()
        expect(result).not.to.equal(undefined)
      })
      it("value from proxy type string", function () {
        const result = proxyTest()
        assert.typeOf(result, "string")
      })
    }
  }
})
describe("The Proxy function with no value", function () {
  if (!proxyTest()) {
    it("value from proxy is null", function () {
      const result = proxyTest()
      expect(result).to.equal(null)
    })
    it("value in not equal to HTTP_PROXY and HTTPS_PROXY", function () {
      const result = proxyTest()
      expect(result).to.not.equal(httpProxy || httpsProxy)
    })
  }
})
