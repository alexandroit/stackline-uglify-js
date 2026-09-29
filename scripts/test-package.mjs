import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
const temp = mkdtempSync(path.join(os.tmpdir(), 'stackline-uglify-packed-'))
function npm(args, cwd) {
  return execFileSync(process.execPath, [process.env.npm_execpath, ...args], {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})
}
try {
  const packed = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', temp], root))
  assert.equal(packed.length, 1)
  const archive = path.join(temp, packed[0].filename)
  for (const key of [manifest.name, 'uglify-js']) {
    const cwd = path.join(temp, key.replace(/[^a-z0-9-]/gi, '-'))
    mkdirSync(cwd)
    writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({name: 'packed-uglify-consumer', private: true, version: '1.0.0', dependencies: {[key]: `file:${archive}`}}))
    npm(['install', '--ignore-scripts', '--omit=dev', '--no-fund'], cwd)
    const installed = JSON.parse(readFileSync(path.join(cwd, 'node_modules', key, 'package.json'), 'utf8'))
    assert.equal(installed.name, manifest.name)
    assert.equal(installed.version, manifest.version)
    assert.deepEqual(installed.dependencies, manifest.dependencies)
    const probe = `const assert = require('node:assert/strict'); const api = require(${JSON.stringify(key)}); const result = api.minify('function answer(){return 6*7} console.log(answer())', {fromString: true, outSourceMap: 'out.js.map'}); assert.equal(typeof result.code, 'string'); assert.equal(JSON.parse(result.map).version, 3); console.log(result.code);`
    const code = execFileSync(process.execPath, ['-e', probe], {cwd, encoding: 'utf8'}).trim()
    assert.equal(execFileSync(process.execPath, ['-e', code], {cwd, encoding: 'utf8'}).trim(), '42')
    const cli = path.join(cwd, 'node_modules', key, 'bin/uglifyjs')
    assert.match(execFileSync(process.execPath, [cli, '--version'], {cwd, encoding: 'utf8'}), new RegExp(manifest.version.replaceAll('.', '\\.')))
    const audit = JSON.parse(npm(['audit', '--omit=dev', '--json'], cwd))
    assert.equal(audit.metadata.vulnerabilities.total, 0)
    const tree = JSON.parse(npm(['ls', '--all', '--omit=dev', '--json'], cwd))
    assert.deepEqual(tree.problems || [], [])
  }
  console.log('Packed direct/legacy-name consumers: synchronous API, source maps, CLI, dependency aliases and production audit passed.')
} finally {
  rmSync(temp, {recursive: true, force: true})
}
