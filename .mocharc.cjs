process.env.TSX_TSCONFIG_PATH = './packages/tests/tsconfig.json'

module.exports = {
  "node-option": [
    "loader=tsx/esm",
    "no-warnings",
    "conditions=peertube:tsx"
  ],
  "timeout": 30000
}
