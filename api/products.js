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

  const q = (req.query.q || '').replace(/"/g, '');
  const collectionId = req.query.collection_id || '';

  let queryFilter = '';
  if (collectionId) {
    // Filter by collection using collection_id in query
    queryFilter = `query: "collection_id:${collectionId}"`;
  } else if (q) {
    queryFilter = `query: "${q}"`;
  }

  // Read local_price from product-level custom metafield
  const gql = `{
    products(first: 50, ${queryFilter}) {
      edges {
        node {
          id
          title
          featuredImage { url }
          localPrice: metafield(namespace: "custom", key: "local_price") {
            value
          }
          caseSize: metafield(namespace: "custom", key: "case_size") {
            value
          }
          variants(first: 1) {
            edges {
              node {
                id
                price
                barcode
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
    const variantId = variant?.id?.split('/').pop();
    return {
      title: p.title,
      variantId,
      retailPrice: variant?.price || '0',
      pharmacyPrice: p.localPrice?.value || null,
      caseSize: p.caseSize?.value || null,
      upc: variant?.barcode || null,
      image: p.featuredImage?.url || null
    };
  });

  return res.json({ products });
}
