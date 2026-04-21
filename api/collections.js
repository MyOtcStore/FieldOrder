// api/collections.js
// GET /api/collections — returns all collections for the category filter bar

const STORE = 'whfks4-hh.myshopify.com';
const API_VER = '2026-04';
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const gql = `{
    collections(first: 80, sortKey: TITLE) {
      edges {
        node {
          id
          title
          handle
        }
      }
    }
  }`;

  const r = await fetch(
    `https://${STORE}/admin/api/${API_VER}/graphql.json`,
    {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gql })
    }
  );
  const d = await r.json();
  const collections = (d?.data?.collections?.edges || []).map(({ node: c }) => ({
    id: c.id.split('/').pop(),
    title: c.title,
    handle: c.handle
  }));

  return res.json({ collections });
}
