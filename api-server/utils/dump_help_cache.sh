cp -r ../../helpCache /tmp/helpCache_copy && rm -f /tmp/helpCache_copy/LOCK && node -e "
const { Level } = require('level');
const db = new Level('/tmp/helpCache_copy', { valueEncoding: 'utf8', createIfMissing: false });
db.open().then(async () => {
  for await (const [key, value] of db.iterator()) {
    const preview = value.length > 200 ? value.substring(0, 200) + '...' : value;
    console.log(key + ' => ' + preview);
  }
  await db.close();
}).catch(e => console.error(e));
"
