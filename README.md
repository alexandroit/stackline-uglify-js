# @stackline/uglify-js

A maintained compatibility fork of `@sheetjs/uglify-js@2.7.4`, preserving the UglifyJS 2 parser, compressor, mangler, synchronous API, and legacy command-line options.

```sh
npm install --save-dev @stackline/uglify-js
```

```js
const UglifyJS = require('@stackline/uglify-js');
const result = UglifyJS.minify('function twice(n) { return n * 2; }', {
  fromString: true
});
console.log(result.code);
```

The `uglifyjs` executable retains legacy build syntax:

```sh
uglifyjs input.js --support-ie8 -m \
  --source-map output.js.map --preamble '/* Build */' -o output.js
```

Version 1.0.0 fixes a hashbang/preamble ordering bug: an input beginning with `#!/usr/bin/env node` keeps that interpreter line first when a build or license preamble is supplied. This follows [upstream issue #1332](https://github.com/mishoo/UglifyJS/issues/1332), reproduced against the published SheetJS fork. The SheetJS fork's forced semicolons and source-map serialization compatibility are retained.

File-pattern matching also escapes literal regular-expression characters correctly. In the file-based API, a basename containing a pipe or POSIX backslash no longer selects unrelated files or produces an invalid regular expression. The existing `*` and `?` wildcard behavior is retained.

The runtime dependencies have been updated. Source maps use the synchronous `source-map-js` API; the original Browserify transformer is included with its MIT attribution. Modern Yargs loads asynchronously only at CLI startup. `minify`, parsing, and the other library APIs remain synchronous.

Requires Node.js 20.19+, 22.12+, or 24+. The optional `--acorn` parser is installed by default and parses the ES5 input accepted by this compatibility release. This package retains UglifyJS 2 syntax and options; it does not add a modern JavaScript compressor. For complete historical API documentation, see [README.upstream.md](README.upstream.md).

Run `npm ci` and `npm test` to check the API, command-line options, source maps, property extraction, and Browserify transformer. Browserify output is exercised in a JavaScript VM; this does not establish compatibility with every browser or bundler.

See [UPSTREAM.md](UPSTREAM.md) for the exact source artifact and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for bundled helper attribution. The UglifyJS source retains its [BSD-2-Clause license](LICENSE).
