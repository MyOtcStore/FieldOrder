// api/customer.js
// GET  /api/customer?q=search    → search customers
// POST /api/customer              → create new pharmacy customer

const STORE = 'whfks4-hh.myshopify.com';
const API_VER = '2026-04';
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'GET') {
    const q = req.query.q || '';
    if (!q) return res.status(400).json({ error: 'Query required' });

    const r = await fetch(
      `https://${STORE}/admin/api/${API_VER}/customers/search.json?query=${encodeURIComponent(q)}&limit=8&fields=id,first_name,last_name,email,phone,tags,note`,
      { headers: { 'X-Shopify-Access-Token': TOKEN } }
    );
    const d = await r.json();
    return res.json({ customers: d.customers || [] });
  }

  if (req.method === 'POST') {
    const { first_name, last_name, pharmacy_name, email, phone, ein, state, address } = req.body;
    if (!first_name || !last_name || !email || !phone || !ein) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const r = await fetch(
      `https://${STORE}/admin/api/${API_VER}/customers.json`,
      {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            first_name, last_name, email, phone,
            tags: 'pharmacy, net30, tax-exempt, pharmacy-approved, wholesale',
            note: `Pharmacy: ${pharmacy_name} | EIN: ${ein} | State: ${state} | Address: ${address}`,
            tax_exempt: true,
            metafields: [
              { namespace: 'pharmacy', key: 'ein', value: ein, type: 'single_line_text_field' },
              { namespace: 'pharmacy', key: 'pharmacy_name', value: pharmacy_name, type: 'single_line_text_field' },
              { namespace: 'pharmacy', key: 'state', value: state || '', type: 'single_line_text_field' }
            ],
            send_email_invite: false
          }
        })
      }
    );
    const d = await r.json();
    if (!r.ok || !d.customer) {
      const msg = d.errors?.email ? 'Email already has an account — search for them above.' : 'Could not create account.';
      return res.status(400).json({ error: msg });
    }
    const c = d.customer;
    return res.json({
      customer: {
        id: c.id, firstName: c.first_name, lastName: c.last_name,
        email: c.email, phone: c.phone, tags: c.tags, note: c.note
      }
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
