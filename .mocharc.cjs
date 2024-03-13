process.env.TSX_TSCONFIG_PATH = './packages/tests/tsconfig.json'

module.exports = {
  "node-option": [
    "import=tsx",
    "no-warnings",
    "conditions=peertube:tsx"
  ],
  "timeout": 30000
}
