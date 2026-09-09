"""Pack a locally supplied Studio export and its missing LDraw primitives.

Run from the repository root. Model assets are not licensed by this project's
MIT license; see docs/model-assets.md before distributing converted files.
"""

import concurrent.futures
import re
import subprocess
from pathlib import Path
from zipfile import ZipFile

MODEL_ID = "mclaren-p1-42172"
CACHE_DIR = Path(".cache") / MODEL_ID


def referenced_files(text):
    return {
        line.split(maxsplit=14)[14].strip().lower().replace('\\', '/')
        for line in text.splitlines()
        if line.startswith('1 ')
    }


def fetch_primitive(name):
    cache = (CACHE_DIR / 'primitives') / name.replace('/', '_')
    if not cache.exists():
        subprocess.run(
            [
                'curl', '-fsSL', '--retry', '2', '--max-time', '30',
                'https://library.ldraw.org/library/official/p/' + name,
                '-o', str(cache),
            ],
            check=True,
        )
    return name, cache.read_text()


def main():
    studio = CACHE_DIR / 'studio'
    studio.mkdir(parents=True, exist_ok=True)
    with ZipFile(Path('assets/source') / MODEL_ID / 'model.io') as archive:
        for filename in ('model.ldr', 'model2.ldr'):
            (studio / filename).write_bytes(archive.read(filename))
    source = (studio / 'model2.ldr').read_text(encoding='utf-8-sig')
    chunks = re.split(r'^0 FILE ', source, flags=re.M)[1:]
    if not chunks:
        raise ValueError('No Studio model definitions found in model2.ldr')
    files = {
        chunk.split('\n', 1)[0].strip().lower().replace('\\', '/'):
        chunk.split('\n', 1)[1]
        for chunk in chunks
    }
    main_file = next(iter(files))
    (CACHE_DIR / 'primitives').mkdir(parents=True, exist_ok=True)

    while True:
        missing = set.union(*(referenced_files(text) for text in files.values())) - files.keys()
        if not missing:
            break
        print(f'Fetching {len(missing)} primitives', flush=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            for name, text in pool.map(fetch_primitive, sorted(missing)):
                files[name] = text

    for name, text in files.items():
        lines = []
        for line in text.splitlines():
            # Studio uses -1 for inherited color; LDraw uses 16.
            if line.startswith('1 '):
                fields = line.split(maxsplit=14)
                fields[14] = fields[14].lower().replace('\\', '/')
                fields[1] = '16' if fields[1] == '-1' else fields[1]
                line = ' '.join(fields)
            elif re.match(r'^[2345] -1 ', line):
                line = line.replace(' -1 ', ' 16 ', 1)
            lines.append(line)
        if name == main_file or '0 IsSubModel True' in text:
            kind = 'Model'
        elif '0 BL_Item_No ' in text:
            kind = 'Part'
        else:
            kind = 'Primitive'
        files[name] = '0 !LDRAW_ORG ' + kind + '\n' + '\n'.join(lines)

    output = (CACHE_DIR / 'packed')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'model.mpd').write_text(
        '\n'.join('0 FILE ' + name + '\n' + text for name, text in files.items())
    )
    subprocess.run(
        [
            'curl', '-fsSL',
            'https://library.ldraw.org/library/official/LDConfig.ldr',
            '-o', str(output / 'LDConfig.ldr'),
        ],
        check=True,
    )
    print(f'Packed {len(files)} files', flush=True)


if __name__ == '__main__':
    main()
