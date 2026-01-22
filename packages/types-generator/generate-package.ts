import { currentDir, root } from '@peertube/peertube-node-utils'
import { execSync } from 'child_process'
import depcheck, { PackageDependencies } from 'depcheck'
import { readJson, remove, writeJSON } from 'fs-extra/esm'
import { copyFile, writeFile } from 'fs/promises'
import { join, resolve } from 'path'

if (!process.argv[2]) {
  console.error('Need version as argument')
  process.exit(-1)
}

const version = process.argv[2]
console.log('Will generate package version %s.', version)

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  const typesPath = currentDir(import.meta.url)
  const typesDistTMPPath = join(typesPath, 'dist-tmp')

  await remove(typesDistTMPPath)

  const mainPackageJson = await readJson(join(root(), 'package.json'))

  const typesTsConfigPath = join(typesPath, 'tsconfig.types.json')

  const distTmpTsConfigPath = join(typesPath, 'tsconfig.dist-tmp.json')
  const distTmpTsConfig = await readJson(distTmpTsConfigPath)

  const clientPackageJson = await readJson(join(root(), 'client', 'package.json'))

  const typesDistPath = join(typesPath, 'dist')
  const rollupConfig = join(typesPath, 'rollup.config.js')

  await remove(typesDistTMPPath)

  execSync(`npm run tsc -- -b ${typesTsConfigPath} --verbose`, { stdio: 'inherit' })
  // eslint-disable-next-line max-len
  execSync(`npm run resolve-tspaths -- --project ${distTmpTsConfigPath} --src ${typesDistTMPPath} --out ${typesDistTMPPath}`, { stdio: 'inherit' })

  execSync(`./node_modules/.bin/rollup -c ${rollupConfig}`, { stdio: 'inherit' })
  await remove(typesDistTMPPath)

  const allDependencies = Object.assign(
    mainPackageJson.dependencies,
    mainPackageJson.devDependencies,
    clientPackageJson.dependencies,
    clientPackageJson.devDependencies
  ) as PackageDependencies

  const toIgnore = Object.keys(distTmpTsConfig?.compilerOptions?.paths || [])

  // https://github.com/depcheck/depcheck#api
  const depcheckOptions = {
    parsers: { '**/*.ts': depcheck.parser.typescript },
    detectors: [
      depcheck.detector.requireCallExpression,
      depcheck.detector.importDeclaration
    ],
    ignoreMatches: toIgnore,
    package: { dependencies: allDependencies }
  }

  const result = await depcheck(typesDistPath, depcheckOptions)

  if (Object.keys(result.invalidDirs).length !== 0) {
    console.error('Invalid directories detected.', { invalidDirs: result.invalidDirs })
    process.exit(-1)
  }

  if (Object.keys(result.invalidFiles).length !== 0) {
    console.error('Invalid files detected.', { invalidFiles: result.invalidFiles })
    process.exit(-1)
  }

  const unusedDependencies = result.dependencies

  console.log(`Removing ${Object.keys(unusedDependencies).length} unused dependencies.`)
  const dependencies = Object
    .keys(allDependencies)
    .filter(dependencyName => !unusedDependencies.includes(dependencyName) && !toIgnore.includes(dependencyName))
    .reduce((dependencies, dependencyName) => {
      dependencies[dependencyName] = allDependencies[dependencyName]
      return dependencies
    }, {})

  const { description, licence, engines, author, repository } = mainPackageJson
  const typesPackageJson = {
    name: '@peertube/peertube-types',
    description,
    version,
    private: false,
    main: '',
    license: licence,
    engines,
    author,
    repository,
    dependencies
  }

  const typesDistPackageJsonPath = join(typesDistPath, 'package.json')
  const typesDistGitIgnorePath = join(typesDistPath, '.gitignore')

  console.log(`Writing package.json to ${typesDistPackageJsonPath}`)
  await writeJSON(typesDistPackageJsonPath, typesPackageJson, { spaces: 2 })

  console.log(`Writing git ignore to ${typesDistGitIgnorePath}`)
  await writeFile(typesDistGitIgnorePath, '*.tsbuildinfo')

  await copyFile(resolve(typesPath, './README.md'), resolve(typesDistPath, './README.md'))
}
