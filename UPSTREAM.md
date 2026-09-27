# Upstream basis

- Package: `@sheetjs/uglify-js@2.7.4`, published 2020-05-21.
- Registry artifact: https://registry.npmjs.org/@sheetjs/uglify-js/-/uglify-js-2.7.4.tgz
- Integrity: `sha512-B4bT0/LXPqLJJPBGc9PB3fuLRHRu+tQ6JeI4/w6hzf2OFbhL09RdliVRuNicjgtV673AkcNq+K59NzPbJ9Ns1Q==`.
- Upstream project: https://github.com/mishoo/UglifyJS
- License: BSD-2-Clause; the original LICENSE and author attribution are retained.

The initial import is the exact published artifact. Its engine is based on UglifyJS 2.7.3, with SheetJS changes to force semicolons after block statements and serialize source maps on modern Node.js. Both changes are preserved.

The hashbang/preamble fix adapts the approach of upstream commit [eb98a7f2f38f5de16b50560199ee7ec719a1e945](https://github.com/mishoo/UglifyJS/commit/eb98a7f2f38f5de16b50560199ee7ec719a1e945), which resolved [#1332](https://github.com/mishoo/UglifyJS/issues/1332). Regression tests exercise the bug and the legacy CLI paths.

CodeQL review found a separate file-pattern correctness bug: `simple_glob` escaped several regex characters but omitted backslash and pipe. It now translates wildcards and escapes literal regex characters in one pass. Tests cover the public file-based minify API and literal POSIX filenames. This review did not establish a separate exploitable vulnerability.

The quote-delimiter replacements in `lib/output.js` intentionally do not re-escape backslashes: the preceding global replacement already escapes every input backslash. Escaping them again would change string values. Regression tests round-trip backslashes, both quote delimiters, control characters, Unicode, and inline-script markers across all quote styles and ASCII modes.

Dependency maintenance replaces the old asynchronous utility and argument parser releases with compatible current releases, uses the synchronous source-map-js implementation, and retains the original MIT-licensed uglify-to-browserify 1.0.2 transformer internally. No vulnerability claim is made: the isolated published baseline installation had no npm audit advisories on 2026-09-27.

This fork has its own 1.x version series. Its package version is not an upstream UglifyJS engine version. It does not imply upstream endorsement.
