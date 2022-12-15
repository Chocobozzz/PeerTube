import { execSync } from 'child_process'
import depcheck, { PackageDependencies } from 'depcheck'
import { copyFile, readJson, remove, writeFile, writeJSON } from 'fs-extra'
import { join, resolve } from 'path'
import { root } from '../../shared/core-utils'

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
  const typesPath = __dirname
  const typesDistPath = join(typesPath, 'dist')
  const typesDistPackageJsonPath = join(typesDistPath, 'package.json')
  const typesDistGitIgnorePath = join(typesDistPath, '.gitignore')
  const mainPackageJson = await readJson(join(root(), 'package.json'))
  const distTsConfigPath = join(typesPath, 'tsconfig.dist.json')
  const distTsConfig = await readJson(distTsConfigPath)
  const clientPackageJson = await readJson(join(root(), 'client', 'package.json'))

  await remove(typesDistPath)
  execSync('npm run tsc -- -b --verbose packages/types', { stdio: 'inherit' })
  execSync(`npm run resolve-tspaths -- --project ${distTsConfigPath} --src ${typesDistPath} --out ${typesDistPath}`, { stdio: 'inherit' })

  const allDependencies = Object.assign(
    mainPackageJson.dependencies,
    mainPackageJson.devDependencies,
    clientPackageJson.dependencies,
    clientPackageJson.devDependencies
  ) as PackageDependencies

  // https://github.com/depcheck/depcheck#api
  const depcheckOptions = {
    parsers: { '**/*.ts': depcheck.parser.typescript },
    detectors: [
      depcheck.detector.requireCallExpression,
      depcheck.detector.importDeclaration
    ],
    ignoreMatches: Object.keys(distTsConfig?.compilerOptions?.paths || []),
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
    .filter(dependencyName => !unusedDependencies.includes(dependencyName))
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
    license: licence,
    engines,
    author,
    repository,
    dependencies
  }
  console.log(`Writing package.json to ${typesDistPackageJsonPath}`)
  await writeJSON(typesDistPackageJsonPath, typesPackageJson, { spaces: 2 })

  console.log(`Writing git ignore to ${typesDistGitIgnorePath}`)
  await writeFile(typesDistGitIgnorePath, '*.tsbuildinfo')

  await copyFile(resolve(typesPath, './README.md'), resolve(typesDistPath, './README.md'))
}
