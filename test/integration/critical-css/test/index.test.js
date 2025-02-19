/* eslint-env jest */
import globOrigig from 'glob'
import { promisify } from 'util'
import { join } from 'path'
import {
  killApp,
  findPort,
  nextStart,
  nextBuild,
  renderViaHTTP,
} from 'next-test-utils'
import fs from 'fs-extra'

const glob = promisify(globOrigig)
const appDir = join(__dirname, '../')
const nextConfig = join(appDir, 'next.config.js')
const nodeArgs = ['-r', join(appDir, '../../lib/react-17-require-hook.js')]
let appPort
let app

function runTests() {
  it('should have all CSS files in manifest', async () => {
    const cssFiles = (
      await glob('**/*.css', {
        cwd: join(appDir, '.next/static'),
      })
    ).map((file) => join('.next/static', file))

    const requiredServerFiles = await fs.readJSON(
      join(appDir, '.next/required-server-files.json')
    )

    expect(
      requiredServerFiles.files.filter((file) => file.endsWith('.css'))
    ).toEqual(cssFiles)
  })

  it('should inline critical CSS', async () => {
    const html = await renderViaHTTP(appPort, '/')
    expect(html).toMatch(
      /<link rel="stylesheet" href="\/_next\/static\/css\/.*\.css" .*>/
    )
    expect(html).toMatch(/body{font-family:SF Pro Text/)
  })

  it('should inline critical CSS (dynamic)', async () => {
    const html = await renderViaHTTP(appPort, '/another')
    expect(html).toMatch(
      /<link rel="stylesheet" href="\/_next\/static\/css\/.*\.css" .*>/
    )
    expect(html).toMatch(/body{font-family:SF Pro Text/)
  })

  it('should not inline non-critical css', async () => {
    const html = await renderViaHTTP(appPort, '/')
    expect(html).not.toMatch(/.extra-style/)
  })
}

describe('CSS optimization for SSR apps', () => {
  beforeAll(async () => {
    await fs.writeFile(
      nextConfig,
      `module.exports = { experimental: {optimizeCss: true} }`,
      'utf8'
    )

    if (fs.pathExistsSync(join(appDir, '.next'))) {
      await fs.remove(join(appDir, '.next'))
    }
    await nextBuild(appDir, undefined, {
      nodeArgs,
    })
    appPort = await findPort()
    app = await nextStart(appDir, appPort, {
      nodeArgs,
    })
  })
  afterAll(async () => {
    await killApp(app)
    await fs.remove(nextConfig)
  })
  runTests()
})

describe('Font optimization for emulated serverless apps', () => {
  beforeAll(async () => {
    await fs.writeFile(
      nextConfig,
      `module.exports = { target: 'experimental-serverless-trace', experimental: {optimizeCss: true} }`,
      'utf8'
    )
    await nextBuild(appDir, undefined, {
      nodeArgs,
    })
    appPort = await findPort()
    app = await nextStart(appDir, appPort, {
      nodeArgs,
    })
  })
  afterAll(async () => {
    await killApp(app)
    await fs.remove(nextConfig)
  })
  runTests()
})
