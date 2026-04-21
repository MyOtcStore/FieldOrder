// api/products.js
// GET /api/products?q=search
// Returns products with pharmacy price from metafield pharmacy.price
// Falls back to retail price if not set

const STORE = 'whfks4-hh.myshopify.com';
const API_VER = '2026-04';
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = req.query.q || '';
  if (!q) return res.status(400).json({ error: 'Query required' });

  // Use GraphQL to get products + pharmacy price metafield in one call
  const gql = `{
    products(first: 20, query: "${q.replace(/"/g, '')}") {
      edges {
        node {
          id
          title
          featuredImage { url }
          variants(first: 1) {
            edges {
              node {
                id
                price
                barcode
                metafield(namespace: "pharmacy", key: "price") {
                  value
                }
              }
            }
          }
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
  const edges = d?.data?.products?.edges || [];

  const products = edges.map(({ node: p }) => {
    const variant = p.variants.edges[0]?.node;
    // Extract numeric ID from gid://shopify/ProductVariant/123
    const variantId = variant?.id?.split('/').pop();
    return {
      title: p.title,
      variantId,
      retailPrice: variant?.price || '0',
      pharmacyPrice: variant?.metafield?.value || null, // null = no pharmacy price set
      upc: variant?.barcode || null,
      image: p.featuredImage?.url || null
    };
  });

  return res.json({ products });
}
