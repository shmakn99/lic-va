import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'docs/presentation');
let html = await readFile(path.join(source, 'deck.template.html'), 'utf8');
for (const match of [...html.matchAll(/src="(assets\/[a-z-]+\.png)"/g)]) {
  const image = await readFile(path.join(source, match[1]));
  html = html.replace(match[0], `src="data:image/png;base64,${image.toString('base64')}"`);
}
await mkdir(path.join(root, 'public'), { recursive: true });
const output = path.join(root, 'public/presentation.html');
await writeFile(output, html);
console.log(`Built ${output} (${Math.round(Buffer.byteLength(html) / 1024)} KiB). All images are embedded.`);
