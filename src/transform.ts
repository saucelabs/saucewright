import Module from 'module';
import path from 'path';
import fs from 'fs';
import * as babel from '@babel/core';
import crypto from 'crypto';
import os from 'os';
import * as pirates from 'pirates';
import sourceMapSupport from 'source-map-support';

const version = 0;
const cacheDir = path.join(os.tmpdir(), 'saucewright-transform-cache');
const builtins = new Set(Module.builtinModules);
const sourceMaps: Map<string, string> = new Map();

sourceMapSupport.install({
  environment: 'node',
  handleUncaughtExceptions: false,
  retrieveSourceMap(source) {
    const sourceMapPath = sourceMaps.get(source);
    if (!sourceMapPath || !fs.existsSync(sourceMapPath)) {
      return null;
    }

    return {
      map: JSON.parse(fs.readFileSync(sourceMapPath, 'utf-8')),
      url: source
    };
  }
});

export function installTransform(): () => void {
  let reverted = false;

  const originalResolveFilename = (Module as any)._resolveFilename;

  function resolveFilename(this: any, specifier: string, parent: Module, ...rest: any[]) {
    if (!reverted && parent) {
      const resolved = resolveHook(parent.filename, specifier);
      if (resolved !== undefined)
        specifier = resolved;
    }
    return originalResolveFilename.call(this, specifier, parent, ...rest);
  }

  (Module as any)._resolveFilename = resolveFilename;

  const revertPirates = pirates.addHook((code: string, filename: string) => {
    if (belongsToNodeModules(filename))
      return code;
    return transformHook(code, filename);
  }, {exts: ['.ts', '.js', '.mjs']});

  return () => {
    reverted = true;
    (Module as any)._resolveFilename = originalResolveFilename;
    revertPirates();
  };
}

export function resolveHook(filename: string, specifier: string): string | undefined {
  if (specifier.startsWith('node:') || builtins.has(specifier))
    return;
  if (belongsToNodeModules(filename))
    return;

  return js2ts(path.resolve(path.dirname(filename), specifier));
}

export function transformHook(code: string, filename: string, moduleUrl?: string): string {
  // If we are not TypeScript and there is no applicable preprocessor - bail out.
  const isModule = !!moduleUrl;
  const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx');

  const cachePath = calculateCachePath(code, filename, isModule);
  const codePath = cachePath + '.js';
  const sourceMapPath = cachePath + '.map';
  sourceMaps.set(moduleUrl || filename, sourceMapPath);
  if (fs.existsSync(codePath)) {
    return fs.readFileSync(codePath, 'utf8');
  }
  // We don't use any browserslist data, but babel checks it anyway. Silence the annoying warning.
  process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true';

  try {
    const result = babelTransform(filename, isTypeScript, isModule);
    if (result.code) {
      fs.mkdirSync(path.dirname(cachePath), {recursive: true});
      if (result.map) {
        fs.writeFileSync(sourceMapPath, JSON.stringify(result.map), 'utf8');
      }
      fs.writeFileSync(codePath, result.code, 'utf8');
    }
    return result.code || '';
  } catch (e: any) {
    // Re-throw error with a saucewright stack that could be filtered out.
    throw new Error(e.message);
  }
}

function calculateCachePath(content: string, filePath: string, isModule: boolean): string {
  const hash = crypto.createHash('sha1')
    .update(isModule ? 'esm' : 'no_esm')
    .update(content)
    .update(filePath)
    .update(String(version))
    .digest('hex');
  const fileName = path.basename(filePath, path.extname(filePath)).replace(/\W/g, '') + '_' + hash;
  return path.join(cacheDir, hash[0] + hash[1], fileName);
}

export function js2ts(resolved: string): string | undefined {
  const match = resolved.match(/(.*)(\.js|\.jsx|\.mjs)$/);
  if (match) {
    const tsResolved = match[1] + match[2].replace('j', 't');
    if (!fs.existsSync(resolved) && fs.existsSync(tsResolved)) {
      return tsResolved;
    }
  }
}

const internalPrefix = path.resolve(__dirname, '../../saucewright');

export function belongsToNodeModules(file: string) {
  if (file.includes(`${path.sep}node_modules${path.sep}`)) {
    return true;
  }
  return file.startsWith(internalPrefix);
}

export function babelTransform(filename: string, isTypeScript: boolean, isModule: boolean) {
  const plugins = [];

  if (isTypeScript) {
    plugins.push(
      [require('@babel/plugin-proposal-class-properties')],
      [require('@babel/plugin-proposal-numeric-separator')],
      [require('@babel/plugin-proposal-logical-assignment-operators')],
      [require('@babel/plugin-proposal-nullish-coalescing-operator')],
      [require('@babel/plugin-proposal-optional-chaining')],
      [require('@babel/plugin-proposal-private-methods')],
      [require('@babel/plugin-syntax-json-strings')],
      [require('@babel/plugin-syntax-optional-catch-binding')],
      [require('@babel/plugin-syntax-async-generators')],
      [require('@babel/plugin-syntax-object-rest-spread')],
      [require('@babel/plugin-proposal-export-namespace-from')]
    );
  }

  if (!isModule) {
    plugins.push([require('@babel/plugin-transform-modules-commonjs')]);
    plugins.push([require('@babel/plugin-proposal-dynamic-import')]);
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    assumptions: {
      // Without this, babel defines a top level function that
      // breaks playwright evaluates.
      setPublicClassFields: true,
    },
    presets: [
      [require('@babel/preset-typescript'), {onlyRemoveTypeImports: false}],
    ],
    plugins,
    sourceMaps: 'both',
  } as babel.TransformOptions)!;
}
