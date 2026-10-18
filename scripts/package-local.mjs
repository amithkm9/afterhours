import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

await mkdir('outputs', { recursive: true });
const destination = resolve('outputs/after-hours-source.zip');
// Python's standard zip writer avoids dependencies and never includes local secrets/tool state.
const script = `
from pathlib import Path
import zipfile, sys, subprocess
root=Path.cwd()
# Respect repository exclusions, including nested tool state and generated output.
tracked = subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'])
paths = []
for name in sorted(set(tracked.decode().split('\\0'))):
    if not name: continue
    path = root / name
    if not path.is_file() or path.is_symlink(): continue
    if path.name.startswith('.dev.vars') or (path.name.startswith('.env') and path.name!='.env.example'): continue
    paths.append(path)
with zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED) as archive:
    for path in paths: archive.write(path,'afterhours/'+str(path.relative_to(root)))
    assert not any('/.git/' in name or '/.dev.vars' in name or '/node_modules/' in name for name in archive.namelist())
print(len(paths))
`;
const files = Number(execFileSync('python3', ['-c', script, destination], { encoding: 'utf8' }).trim());
console.log(JSON.stringify({ path: destination, files, credentialsIncluded: false }));
