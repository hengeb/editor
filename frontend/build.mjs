import * as esbuild from 'esbuild';

await esbuild.build({
    entryPoints: ['src/app.js'],
    bundle: true,
    outfile: 'dist/bundle.js',
    format: 'iife',
    target: 'es2022',
    minify: true,
    sourcemap: true,
    logLevel: 'info',
    loader: {
        '.svg': 'text',
    },
});
