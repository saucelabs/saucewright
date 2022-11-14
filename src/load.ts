import fs from 'fs';
import path from 'path';
import {installTransform} from './transform';
import url from 'url';

const folderToPackageJsonPath = new Map<string, string>();

export async function requireOrImportDefaultObject(file: string) {
  let object = await requireOrImport(file);
  if (object && typeof object === 'object' && ('default' in object))
    object = object['default'];
  return object;
}

async function requireOrImport(file: string) {
  const revertTransform = installTransform();
  const isModule = fileIsModule(file);
  try {
    const esmImport = () => eval(`import(${JSON.stringify(url.pathToFileURL(file))})`);
    if (isModule) {
      return await esmImport();
    }
    return require(file);
  } finally {
    revertTransform();
  }
}

function fileIsModule(file: string): boolean {
  if (file.endsWith('.mjs')) {
    return true;
  }

  const folder = path.dirname(file);
  return folderIsModule(folder);
}

function folderIsModule(folder: string): boolean {
  const packageJsonPath = getPackageJsonPath(folder);
  if (!packageJsonPath) {
    return false;
  }
  // Rely on `require` internal caching logic.
  return require(packageJsonPath).type === 'module';
}

function getPackageJsonPath(folderPath: string): string {
  const cached = folderToPackageJsonPath.get(folderPath);
  if (cached !== undefined) {
    return cached;
  }

  const packageJsonPath = path.join(folderPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    folderToPackageJsonPath.set(folderPath, packageJsonPath);
    return packageJsonPath;
  }

  const parentFolder = path.dirname(folderPath);
  if (folderPath === parentFolder) {
    folderToPackageJsonPath.set(folderPath, '');
    return '';
  }

  const result = getPackageJsonPath(parentFolder);
  folderToPackageJsonPath.set(folderPath, result);
  return result;
}
