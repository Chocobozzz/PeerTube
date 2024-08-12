import { dts } from 'rollup-plugin-dts'

const config = [
  {
    input: './packages/types-generator/dist-tmp/index.d.ts',
    output: [ { file: './packages/types-generator/dist/index.d.ts', format: 'es' } ],
    plugins: [ dts({ tsconfig: './packages/types-generator/tsconfig.dist-tmp.json' }) ],
  },
  {
    input: './packages/types-generator/dist-tmp/client/index.d.ts',
    output: [ { file: './packages/types-generator/dist/client/index.d.ts', format: 'es' } ],
    plugins: [ dts({ tsconfig: './packages/types-generator/tsconfig.dist-tmp.json' }) ],
  }
]

export default config
