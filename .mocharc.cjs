process.env.ESBK_TSCONFIG_PATH = './packages/tests/tsconfig.json'

module.exports = {
  "node-option": [
    "loader=tsx",
    "no-warnings",
    "conditions=peertube:tsx"
  ],
  "timeout": 30000
}
