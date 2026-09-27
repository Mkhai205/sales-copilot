import * as fs from 'fs';
import * as path from 'path';

/**
 * Returns the absolute path to the workspace root directory.
 */
export function getWorkspaceRootDir(): string {
  let curr = __dirname;
  while (curr && curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, 'pnpm-workspace.yaml'))) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return path.resolve(__dirname, '../../../../..');
}

/**
 * Recursively retrieves all files matching given extensions within a directory,
 * ignoring node_modules, dist, .next, and git folders.
 */
export function getSourceFiles(
  dir: string,
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx'],
  ignorePatterns: string[] = ['node_modules', 'dist', '.next', '.git', 'coverage', '.agents'],
): string[] {
  let results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const list = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);

    if (ignorePatterns.some(pat => entry.name === pat || fullPath.includes(path.sep + pat))) {
      continue;
    }

    if (entry.isDirectory()) {
      results = results.concat(getSourceFiles(fullPath, extensions, ignorePatterns));
    } else if (entry.isFile()) {
      if (extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Scans a set of files for matches against a regex pattern.
 * Returns array of matches with file path and line numbers.
 */
export function scanFilesForPattern(
  files: string[],
  pattern: RegExp,
): Array<{ file: string; line: number; match: string }> {
  const matches: Array<{ file: string; line: number; match: string }> = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((lineText, idx) => {
      pattern.lastIndex = 0;
      const match = pattern.exec(lineText);
      if (match) {
        matches.push({
          file: path.relative(getWorkspaceRootDir(), file).replace(/\\/g, '/'),
          line: idx + 1,
          match: match[0],
        });
      }
    });
  }

  return matches;
}

/**
 * Helper simulating the getAppUrl() specification for frontend environments.
 */
export function simulateGetAppUrl(mockWindowOrigin?: string, envAppUrl?: string): string {
  if (mockWindowOrigin) {
    return mockWindowOrigin;
  }
  return envAppUrl || 'http://localhost:3000';
}

/**
 * Helper simulating the localhost detection specification for webhooks.
 */
export function isLocalhostOrigin(originOrUrl: string): boolean {
  if (!originOrUrl || typeof originOrUrl !== 'string') return false;
  try {
    const url = new URL(originOrUrl.startsWith('http') ? originOrUrl : `http://${originOrUrl}`);
    const host = url.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.localhost')
    );
  } catch {
    const lower = originOrUrl.toLowerCase();
    return lower.includes('localhost') || lower.includes('127.0.0.1') || lower.includes('0.0.0.0');
  }
}
