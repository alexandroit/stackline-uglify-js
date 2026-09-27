'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const U = require('..');

test('string literal escaping preserves backslashes, delimiters and control characters', () => {
    const values = [
        '', '\\', '\\\\', "'", '"', "\\'", '\\"', "\\\\'", '\\\\"',
        "'; throw new Error('unexpected evaluation'); //", '\\"; result=42; //',
        '\0', '\x001', '\x008', '\n\r\t\b\f\v', '\u2028\u2029\ufeff',
        '</script><!-- -->', '\\</script>\\<!--\\-->', 'café 東京'
    ];
    for (const value of values) {
        for (const quote_style of [0, 1, 2, 3]) {
            for (const quote of ["'", '"']) {
                for (const ascii_only of [false, true]) {
                    const literal = new U.AST_String({ value, quote }).print_to_string({
                        quote_style, ascii_only, inline_script: true, screw_ie8: false
                    });
                    assert.equal(vm.runInNewContext(literal, {}, { timeout: 1000 }), value,
                        JSON.stringify({ value, quote_style, quote, ascii_only, literal }));
                }
            }
        }
    }
});

test('simple_glob treats regex metacharacters literally and keeps wildcard behavior', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stackline-glob-'));
    try {
        const names = ['name.$+[a](b){c}^-one.js', 'name.other.js', 'question-A.js', 'question-AB.js'];
        for (const name of names) fs.writeFileSync(path.join(dir, name), 'var result=1;');
        assert.deepEqual(U.simple_glob(path.join(dir, 'name.$+[a](b){c}^-*.js')),
            [path.join(dir, names[0])]);
        assert.deepEqual(U.simple_glob(path.join(dir, 'question-?.js')),
            [path.join(dir, 'question-A.js')]);
        assert.deepEqual(U.simple_glob(path.join(dir, 'missing-*.js')),
            [path.join(dir, 'missing-*.js')]);
        assert.deepEqual(U.simple_glob([path.join(dir, 'question-?.js'), 'literal.js']),
            [path.join(dir, 'question-A.js'), 'literal.js']);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('POSIX backslash and pipe filenames cannot become regex escapes or alternation',
    { skip: process.platform === 'win32' }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stackline-glob-posix-'));
    try {
        fs.writeFileSync(path.join(dir, 'left|right-one.js'), 'console.log("kept");');
        fs.writeFileSync(path.join(dir, 'left-unrelated.js'), 'throw new Error("wrong file");');
        fs.writeFileSync(path.join(dir, 'back\\(one.js'), 'var correct=1;');
        assert.deepEqual(U.simple_glob(path.join(dir, 'left|right-*.js')),
            [path.join(dir, 'left|right-one.js')]);
        assert.deepEqual(U.simple_glob(path.join(dir, 'back\\(*.js')),
            [path.join(dir, 'back\\(one.js')]);
        const code = U.minify(path.join(dir, 'left|right-*.js')).code;
        assert.equal(execFileSync(process.execPath, ['-e', code], { encoding: 'utf8' }), 'kept\n');
        // On POSIX the CLI leaves wildcard expansion to the invoking shell.
        const cliCode = execFileSync(process.execPath,
            [path.resolve(__dirname, '../bin/uglifyjs'), path.join(dir, 'left|right-one.js')],
            { encoding: 'utf8' });
        assert.equal(execFileSync(process.execPath, ['-e', cliCode], { encoding: 'utf8' }), 'kept\n');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
