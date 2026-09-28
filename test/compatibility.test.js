'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync, spawnSync } = require('node:child_process');
const U = require('..');
const { SourceMapConsumer } = require('source-map-js');
const cliPath = path.resolve(__dirname, '../bin/uglifyjs');
const cli = (args, options = {}) => execFileSync(process.execPath, [cliPath, ...args],
    { encoding: 'utf8', ...options });

test('synchronous minify preserves executable hashbang before preamble (#1332)', () => {
    const result = U.minify('#!/usr/bin/env node\nconsole.log(42);', {
        fromString: true, output: { preamble: '/* Build */' }
    });
    assert.equal(typeof result.then, 'undefined');
    assert.equal(result.code, '#!/usr/bin/env node\n/* Build */\nconsole.log(42);');
    assert.equal(execFileSync(process.execPath, ['-e', result.code], { encoding: 'utf8' }), '42\n');
});

test('preamble handles normal input, empty input, comments and disabled hashbang', () => {
    for (const [source, expected] of [
        ['var a=1;', '/* Build */\nvar a=1;'],
        ['', '/* Build */\n'],
        ['#!/usr/bin/env node\nvar a=1;', '/* Build */\nvar a=1;']
    ]) assert.equal(U.minify(source, { fromString: true, compress: false, mangle: false,
        output: { preamble: '/* Build */', shebang: false } }).code, expected);
    const output = U.minify('#!/usr/bin/env node\n/*! license */\nvar a=1;', {
        fromString: true, output: { preamble: '/* Build */', comments: true }
    }).code;
    assert.ok(output.startsWith('#!/usr/bin/env node\n/* Build */\n/*! license */'));
    assert.equal((output.match(/#!/g) || []).length, 1);
    assert.equal(new U.AST_Number({ value: 1 }).print_to_string({ preamble: '/* Build */' }),
        '/* Build */\n1');
    assert.equal(U.OutputStream({ preamble: '/* Build */' }).get(), '/* Build */\n');
    const ast = U.parse('var a=1;');
    assert.equal(ast.print_to_string({ preamble: '/* First */' }), '/* First */\nvar a=1;');
    assert.equal(ast.print_to_string({ preamble: '/* Second */' }), '/* Second */\nvar a=1;');
});

test('legacy CLI flags support IE8, mangling, preamble, multiple files and source maps', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stackline-uglify-'));
    try {
        fs.writeFileSync(path.join(dir, '123.js'), '#!/usr/bin/env node\nvar result=[];\n');
        fs.writeFileSync(path.join(dir, 'second.js'), '(function(longName){result.push(longName+1);})(41);\nconsole.log(result[0]);');
        cli(['123.js', 'second.js', '--support-ie8', '-m', '--source-map', 'bundle.js.map',
            '--source-map-include-sources', '--preamble', '/* Build */', '-o', 'bundle.js'], { cwd: dir });
        const code = fs.readFileSync(path.join(dir, 'bundle.js'), 'utf8');
        assert.ok(code.startsWith('#!/usr/bin/env node\n/* Build */\n'));
        assert.equal(execFileSync(process.execPath, [path.join(dir, 'bundle.js')], { encoding: 'utf8' }), '42\n');
        const map = JSON.parse(fs.readFileSync(path.join(dir, 'bundle.js.map'), 'utf8'));
        assert.deepEqual(map.sources, ['123.js', 'second.js']);
        assert.equal(map.sourcesContent.length, 2);
        const consumer = new SourceMapConsumer(map);
        const position = consumer.originalPositionFor({ line: 3, column: 0 });
        assert.equal(position.source, '123.js');
        assert.equal(position.line, 2);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Uglify 2 compression and reserved-name options preserve ES5 behavior', () => {
    const source = 'var result=(function(n){var keep=n+1;return {default:keep};})(41);';
    const result = U.minify(source, { fromString: true,
        compress: { screw_ie8: false }, mangle: { screw_ie8: false, except: ['keep'] },
        output: { screw_ie8: false } });
    const context = {};
    vm.runInNewContext(result.code, context);
    assert.equal(context.result.default, 42);
    assert.equal(cli(['--support-ie8', '-c', '-m', '-r', 'keep'], { input: source }).trim(), result.code);
});

test('stdin, optional Acorn parsing, help/version and failure exit codes remain usable', () => {
    assert.equal(cli([], { input: 'var a = 1;' }).trim(), 'var a=1;');
    assert.equal(cli(['--acorn'], { input: 'var a = 1;' }).trim(), 'var a=1;');
    assert.match(cli(['--help']), /support-ie8/);
    assert.equal(cli(['--version']).trim(), '@stackline/uglify-js ' + require('../package.json').version);
    assert.equal(spawnSync(process.execPath, [cliPath], { input: 'function {' }).status, 1);
    assert.equal(spawnSync(process.execPath, [cliPath, 'nonexistent-file.js']).status, 1);
});

test('property extraction CLI still works with modern argument parsing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stackline-props-'));
    try {
        const source = path.join(dir, 'source.js');
        fs.writeFileSync(source, 'var value={first:1}; value.second; value["third"];');
        const result = JSON.parse(execFileSync(process.execPath,
            [path.resolve(__dirname, '../bin/extract-props.js'), source], { encoding: 'utf8' }));
        assert.deepEqual(Object.keys(result.props).sort(), ['first', 'second', 'third']);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('browserify compatibility transformer emits a functioning synchronous API', async () => {
    const transform = require('../tools/browserify');
    const stream = transform(path.resolve(__dirname, '../tools/node.js'));
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    const done = new Promise((resolve, reject) => { stream.on('end', resolve); stream.on('error', reject); });
    stream.end('ignored Node wrapper');
    await done;
    const context = { exports: {}, console, require(name) {
        if (name === 'source-map-js' || name === 'util') return require(name);
        throw new Error('Unexpected browser dependency: ' + name);
    } };
    vm.runInNewContext(Buffer.concat(chunks).toString(), context);
    assert.equal(context.exports.minify('var a = 1;', { fromString: true }).code, 'var a=1;');
});
