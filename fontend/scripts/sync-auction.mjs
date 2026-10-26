import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const migrationPath = new URL('../../supabase/migrations/202610260001_auction.sql', import.meta.url)
const server = await createServer({ root, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
try {
  const { collections } = await server.ssrLoadModule('/src/data/artworks.js')
  const quote = value => `'${value.replaceAll("'", "''")}'`
  const records = collections.flatMap(collection => collection.artworks)
  const values = records.map(artwork => `  (${quote(artwork.id)}, ${quote(artwork.title)}, 1000)`).join(',\n')
  const seed = `-- BEGIN GENERATED ARTWORKS: npm run sync:auction in fontend\ninsert into auction_private.artworks(id, title, starting_price_cents) values\n${values}\non conflict (id) do update set title = excluded.title;\n-- END GENERATED ARTWORKS`
  const source = await readFile(migrationPath, 'utf8')
  const updated = source.replace(/-- BEGIN GENERATED ARTWORKS[\s\S]*?-- END GENERATED ARTWORKS/, seed)
  if (process.argv.includes('--check')) {
    if (source !== updated) throw new Error('Auction artworks are out of sync. Run npm run sync:auction in fontend.')
  } else {
    await writeFile(migrationPath, updated)
  }
} finally { await server.close() }
