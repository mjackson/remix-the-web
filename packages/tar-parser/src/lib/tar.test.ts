import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fixtures, readFixture } from '../../test/utils.ts';

import { type TarHeader, parseTar } from './tar.ts';

async function bufferStream(
  stream: ReadableStream<Uint8Array>,
  encoding = 'utf-8',
): Promise<string> {
  let decoder = new TextDecoder(encoding);
  let string = '';

  for await (let chunk of stream) {
    string += decoder.decode(chunk, { stream: true });
  }

  string += decoder.decode();

  return string;
}

describe('TarParser', () => {
  it('parses express-4.21.1.tgz', async () => {
    let entries: [string, number][] = [];
    await parseTar(readFixture(fixtures.expressNpmPackage), (entry) => {
      entries.push([entry.name, entry.size]);
    });

    assert.deepEqual(entries, [
      ['package/LICENSE', 1249],
      ['package/lib/application.js', 14593],
      ['package/lib/express.js', 2409],
      ['package/index.js', 224],
      ['package/lib/router/index.js', 15123],
      ['package/lib/middleware/init.js', 853],
      ['package/lib/router/layer.js', 3296],
      ['package/lib/middleware/query.js', 885],
      ['package/lib/request.js', 12505],
      ['package/lib/response.js', 28729],
      ['package/lib/router/route.js', 4399],
      ['package/lib/utils.js', 5871],
      ['package/lib/view.js', 3325],
      ['package/package.json', 2708],
      ['package/History.md', 114974],
      ['package/Readme.md', 9806],
    ]);
  });

  it('parses fetch-proxy-0.1.0.tar.gz', async () => {
    let entries: [string, number][] = [];
    await parseTar(readFixture(fixtures.fetchProxyGithubArchive), (entry) => {
      entries.push([entry.name, entry.size]);
    });

    assert.equal(entries.length, 192);
  });

  it('parses lodash-4.17.21.tgz', async () => {
    let entries: [string, number][] = [];
    await parseTar(readFixture(fixtures.lodashNpmPackage), (entry) => {
      entries.push([entry.name, entry.size]);
    });

    assert.equal(entries.length, 1054);
  });
});

describe('tar-stream test cases', () => {
  it('parses one-file.tar', async () => {
    let entries: [TarHeader, string][] = [];
    await parseTar(readFixture(fixtures.oneFile), async (entry) => {
      entries.push([entry.header, await bufferStream(entry.body)]);
    });

    assert.deepEqual(entries, [
      [
        {
          name: 'test.txt',
          mode: 0o644,
          uid: 501,
          gid: 20,
          size: 12,
          mtime: 1387580181,
          type: 'file',
          linkname: null,
          uname: 'maf',
          gname: 'staff',
          devmajor: 0,
          devminor: 0,
          pax: null,
        },
        'hello world\n',
      ],
    ]);
  });

  it('parses multi-file.tar', async () => {
    let entries: [TarHeader, string][] = [];
    await parseTar(readFixture(fixtures.multiFile), async (entry) => {
      entries.push([entry.header, await bufferStream(entry.body)]);
    });

    assert.deepEqual(entries, [
      [
        {
          name: 'file-1.txt',
          mode: 0o644,
          uid: 501,
          gid: 20,
          size: 12,
          mtime: 1387580181,
          type: 'file',
          linkname: null,
          uname: 'maf',
          gname: 'staff',
          devmajor: 0,
          devminor: 0,
          pax: null,
        },
        'i am file-1\n',
      ],
      [
        {
          name: 'file-2.txt',
          mode: 0o644,
          uid: 501,
          gid: 20,
          size: 12,
          mtime: 1387580181,
          type: 'file',
          linkname: null,
          uname: 'maf',
          gname: 'staff',
          devmajor: 0,
          devminor: 0,
          pax: null,
        },
        'i am file-2\n',
      ],
    ]);
  });

  it('parses pax.tar', async () => {
    let entries: [TarHeader, string][] = [];
    await parseTar(readFixture(fixtures.pax), async (entry) => {
      entries.push([entry.header, await bufferStream(entry.body)]);
    });

    assert.deepEqual(entries, [
      [
        {
          name: 'pax.txt',
          mode: 0o644,
          uid: 501,
          gid: 20,
          size: 12,
          mtime: 1387580181,
          type: 'file',
          linkname: null,
          uname: 'maf',
          gname: 'staff',
          devmajor: 0,
          devminor: 0,
          pax: {
            path: 'pax.txt',
            special: 'sauce',
          },
        },
        'hello world\n',
      ],
    ]);
  });

  it('parses types.tar', async () => {
    let headers: TarHeader[] = [];
    await parseTar(readFixture(fixtures.types), async (entry) => {
      headers.push(entry.header);
    });

    assert.deepEqual(headers, [
      {
        name: 'directory',
        mode: 0o755,
        uid: 501,
        gid: 20,
        size: 0,
        mtime: 1387580181,
        type: 'directory',
        linkname: null,
        uname: 'maf',
        gname: 'staff',
        devmajor: 0,
        devminor: 0,
        pax: null,
      },
      {
        name: 'directory-link',
        mode: 0o755,
        uid: 501,
        gid: 20,
        size: 0,
        mtime: 1387580181,
        type: 'symlink',
        linkname: 'directory',
        uname: 'maf',
        gname: 'staff',
        devmajor: 0,
        devminor: 0,
        pax: null,
      },
    ]);
  });

  it('parses long-name.tar', async () => {
    let entries: [TarHeader, string][] = [];
    await parseTar(readFixture(fixtures.longName), async (entry) => {
      entries.push([entry.header, await bufferStream(entry.body)]);
    });

    assert.deepEqual(entries, [
      [
        {
          name: 'my/file/is/longer/than/100/characters/and/should/use/the/prefix/header/foobarbaz/foobarbaz/foobarbaz/foobarbaz/foobarbaz/foobarbaz/filename.txt',
          mode: 0o644,
          uid: 501,
          gid: 20,
          size: 16,
          mtime: 1387580181,
          type: 'file',
          linkname: null,
          uname: 'maf',
          gname: 'staff',
          devmajor: 0,
          devminor: 0,
          pax: null,
        },
        'hello long name\n',
      ],
    ]);
  });

  it('parses unicode-bsd.tar', async () => {
    let headers: TarHeader[] = [];
    await parseTar(readFixture(fixtures.unicodeBsd), async (entry) => {
      headers.push(entry.header);
    });

    assert.deepEqual(headers, [
      {
        name: 'høllø.txt',
        mode: 0o644,
        uid: 501,
        gid: 20,
        size: 4,
        mtime: 1387588646,
        type: 'file',
        linkname: null,
        uname: 'maf',
        gname: 'staff',
        devmajor: 0,
        devminor: 0,
        pax: {
          'SCHILY.dev': '16777217',
          'SCHILY.ino': '3599143',
          'SCHILY.nlink': '1',
          atime: '1387589077',
          ctime: '1387588646',
          path: 'høllø.txt',
        },
      },
    ]);
  });

  it('parses unicode.tar', async () => {
    let headers: TarHeader[] = [];
    await parseTar(readFixture(fixtures.unicode), async (entry) => {
      headers.push(entry.header);
    });

    assert.deepEqual(headers, [
      {
        name: 'høstål.txt',
        mode: 0o644,
        uid: 501,
        gid: 20,
        size: 8,
        mtime: 1387580181,
        type: 'file',
        linkname: null,
        uname: 'maf',
        gname: 'staff',
        devmajor: 0,
        devminor: 0,
        pax: { path: 'høstål.txt' },
      },
    ]);
  });

  it('parses name-is-100.tar', async () => {
    let entries: [number, string][] = [];
    await parseTar(readFixture(fixtures.nameIs100), async (entry) => {
      entries.push([entry.header.name.length, await bufferStream(entry.body)]);
    });

    assert.deepEqual(entries, [[100, 'hello\n']]);
  });

  it('parses space.tar', async () => {
    let entries: [TarHeader, string][] = [];
    await parseTar(readFixture(fixtures.space), async (entry) => {
      entries.push([entry.header, await bufferStream(entry.body)]);
    });

    assert.equal(entries.length, 4);
  });

  it('parses gnu-long-path.tar', async () => {
    let entries: [TarHeader, string][] = [];
    await parseTar(readFixture(fixtures.gnuLongPath), async (entry) => {
      entries.push([entry.header, await bufferStream(entry.body)]);
    });

    assert.equal(entries.length, 1);
  });

  it('parses base-256-uid-gid.tar', async () => {
    let headers: TarHeader[] = [];
    await parseTar(readFixture(fixtures.base256UidGid), async (entry) => {
      headers.push(entry.header);
    });

    assert.equal(headers.length, 1);
    assert.equal(headers[0].uid, 116435139);
    assert.equal(headers[0].gid, 1876110778);
  });

  it('parses base-256-size.tar', async () => {
    let headers: TarHeader[] = [];
    await parseTar(readFixture(fixtures.base256Size), async (entry) => {
      headers.push(entry.header);
    });

    assert.deepEqual(headers, [
      {
        name: 'test.txt',
        mode: 0o644,
        uid: 501,
        gid: 20,
        size: 12,
        mtime: 1387580181,
        type: 'file',
        linkname: null,
        uname: 'maf',
        gname: 'staff',
        devmajor: 0,
        devminor: 0,
        pax: null,
      },
    ]);
  });

  it('parses latin1.tar', async () => {
    let entries: [TarHeader, string][] = [];
    await parseTar(readFixture(fixtures.latin1), { filenameEncoding: 'latin1' }, async (entry) => {
      entries.push([entry.header, await bufferStream(entry.body)]);
    });

    assert.deepEqual(entries, [
      [
        {
          name: "En français, s'il vous plaît?.txt",
          mode: 0o644,
          uid: 0,
          gid: 0,
          size: 14,
          mtime: 1495941034,
          type: 'file',
          linkname: null,
          uname: 'root',
          gname: 'root',
          devmajor: 0,
          devminor: 0,
          pax: null,
        },
        'Hello, world!\n',
      ],
    ]);
  });

  it('throws when parsing incomplete.tar', async () => {
    await assert.rejects(
      async () => {
        await parseTar(readFixture(fixtures.incomplete), () => {});
      },
      {
        name: 'TarParseError',
        message: 'Unexpected end of archive',
      },
    );
  });

  it('parses gnu.tar', async () => {
    let entries: [TarHeader, string][] = [];
    await parseTar(readFixture(fixtures.gnu), async (entry) => {
      entries.push([entry.header, await bufferStream(entry.body)]);
    });

    assert.deepEqual(entries, [
      [
        {
          name: 'test.txt',
          mode: 0o644,
          uid: 12345,
          gid: 67890,
          size: 14,
          mtime: 1559239869,
          type: 'file',
          linkname: null,
          uname: 'myuser',
          gname: 'mygroup',
          devmajor: 0,
          devminor: 0,
          pax: null,
        },
        'Hello, world!\n',
      ],
    ]);
  });

  it('parses gnu-incremental.tar', async () => {
    let entries: [TarHeader, string][] = [];
    await parseTar(readFixture(fixtures.gnuIncremental), async (entry) => {
      entries.push([entry.header, await bufferStream(entry.body)]);
    });

    assert.deepEqual(entries, [
      [
        {
          name: 'test.txt',
          mode: 0o644,
          uid: 12345,
          gid: 67890,
          size: 14,
          mtime: 1559239869,
          type: 'file',
          linkname: null,
          uname: 'myuser',
          gname: 'mygroup',
          devmajor: 0,
          devminor: 0,
          pax: null,
        },
        'Hello, world!\n',
      ],
    ]);
  });

  it('parses sparse.tar', async () => {
    /* sparse.tar generated with:

      truncate -s 32K sparsefile

      # Insert multiple sparse data segments
      echo -n "DATA1" | dd of=sparsefile bs=1 seek=0 conv=notrunc
      echo -n "DATA2" | dd of=sparsefile bs=1 seek=8192 conv=notrunc
      echo -n "DATA3" | dd of=sparsefile bs=1 seek=16384 conv=notrunc

      tar --sparse -cf sparse.tar sparsefile
    */
    let blockSize = 4096;
    let entries: { name: string; data: Uint8Array; header: TarHeader }[] = [];

    await parseTar(readFixture(fixtures.sparse), async (entry) => {
      let data = await entry.bytes();
      entries.push({ name: entry.name, data, header: entry.header });
    });
    assert.equal(entries.length, 1);
    const { name, data, header } = entries[0];
    assert.equal(name, 'sparse');
    assert.equal(data.length, blockSize * 8);
    assert.deepEqual(header.sparseMap, [
      {
        offset: 0,
        size: 4096,
      },
      {
        offset: 8192,
        size: 4096,
      },
      {
        offset: 16384,
        size: 4096,
      },
      {
        offset: 32768,
        size: 0,
      },
    ]);

    let dec = new TextDecoder();

    for (let i = 0; i < 3; i++) {
      let exp = `DATA${i + 1}`;
      assert.equal(
        dec.decode(data.subarray(i * blockSize * 2, i * blockSize * 2 + exp.length)),
        exp,
      );
    }
  });

  it('parses sparse-extended.tar', async () => {
    /* sparse.tar generated with:

      block_size=4096
      truncate -s $((block_size*20)) sparse

      for i in {1..20..2}; do
        echo -n "DATA$i" | dd of=sparse bs=1 seek=$((i*block_size)) conv=notrunc
      done

      tar --sparse -cf sparse.tar sparse
    */
    let blockSize = 4096;
    let entries: { name: string; data: Uint8Array; header: TarHeader }[] = [];

    await parseTar(readFixture(fixtures.sparseExtended), async (entry) => {
      let data = await entry.bytes();
      entries.push({ name: entry.name, data, header: entry.header });
    });
    assert.equal(entries.length, 1);
    const { name, data, header } = entries[0];
    assert.equal(name, 'sparse');
    assert.equal(data.length, blockSize * 20);
    assert.deepEqual(header.sparseMap, [
      { offset: 4096, size: 4096 },
      { offset: 12288, size: 4096 },
      { offset: 20480, size: 4096 },
      { offset: 28672, size: 4096 },
      { offset: 36864, size: 4096 },
      { offset: 45056, size: 4096 },
      { offset: 53248, size: 4096 },
      { offset: 61440, size: 4096 },
      { offset: 69632, size: 4096 },
      { offset: 77824, size: 4096 },
      { offset: 81920, size: 0 },
    ]);

    let dec = new TextDecoder();

    for (let i = 1; i < 20; i += 2) {
      let exp = `DATA${i}`;
      assert.equal(dec.decode(data.subarray(i * blockSize, i * blockSize + exp.length)), exp);
    }

    for (let i = 0; i < 10; i++) {
      assert.equal(data[i], 0);
    }
  });
});
