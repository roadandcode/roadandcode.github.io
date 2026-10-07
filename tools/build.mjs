// Assembles the deployable site in dist/: the static pages plus every WebGL build
// listed in data/projects.json. Vercel runs this as the build command.
//
// Builds are pulled from each game repo's GitHub Release (webgl.tar.gz), so no
// build binaries live in this repo. A folder at play/<id>/ wins over the release,
// which is how I test a build locally before tagging it.

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const SITE = ['index.html', 'project.html', '404.html', 'assets', 'data'];
const OUT = 'dist';
const ASSET = 'webgl.tar.gz';

function releaseUrl({ repo, tag, asset = ASSET }) {
    const base = `https://github.com/${repo}/releases`;
    return tag ? `${base}/download/${tag}/${asset}` : `${base}/latest/download/${asset}`;
}

async function fetchBuild(project, dest) {
    const url = project.build.url ?? releaseUrl(project.build);
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`${project.id}: ${res.status} from ${url}`);

    const bytes = Buffer.from(await res.arrayBuffer());
    await mkdir(dest, { recursive: true });
    // Extract from inside dest with a relative name: GNU tar on Windows reads "C:\..." as a remote host.
    await writeFile(join(dest, ASSET), bytes);
    execFileSync('tar', ['-xzf', ASSET], { cwd: dest, stdio: 'inherit' });
    await rm(join(dest, ASSET), { force: true });
    return bytes.length;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT);
for (const entry of SITE) await cp(entry, join(OUT, entry), { recursive: true });

const { projects } = JSON.parse(await readFile('data/projects.json', 'utf8'));
const playable = projects.filter((p) => p.status === 'live' && p.build);

for (const project of playable) {
    const dest = join(OUT, 'play', project.id);
    const local = join('play', project.id);

    if (existsSync(local)) {
        await cp(local, dest, { recursive: true });
        console.log(`${project.id}: copied local build from ${local}/`);
    } else {
        const size = await fetchBuild(project, dest);
        console.log(`${project.id}: fetched ${(size / 1048576).toFixed(1)} MB from ${project.build.repo}`);
    }

    // A missing index.html means the archive wasn't packed from the build root.
    if (!existsSync(join(dest, 'index.html'))) {
        throw new Error(`${project.id}: no index.html in ${resolve(dest)}`);
    }
}

console.log(`dist/ ready: ${playable.length} playable ${playable.length === 1 ? 'build' : 'builds'}`);
