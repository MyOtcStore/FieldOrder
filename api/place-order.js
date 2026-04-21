// api/place-order.js
// POST /api/place-order
// Creates a Shopify Draft Order with pharmacy pricing, marks as Net 30, completes it

const STORE = 'whfks4-hh.myshopify.com';
const API_VER = '2026-04';
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const REP_NAME = process.env.REP_NAME || 'Sales Rep';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { customerId, lineItems, notes, taxExempt } = req.body;
  if (!customerId || !lineItems || lineItems.length === 0) {
    return res.status(400).json({ error: 'Missing customer or line items' });
  }

  try {
    // ─── 1. Create Draft Order with pharmacy prices ───────────────────────
    const draftBody = {
      draft_order: {
        customer: { id: customerId },
        line_items: lineItems.map(item => ({
          variant_id: parseInt(item.variantId),
          quantity: item.qty,
          price: parseFloat(item.pharmacyPrice).toFixed(2),
          applied_discount: null
        })),
        tax_exempt: taxExempt !== false,
        tags: 'pharmacy, net30, rep-order',
        note: [
          `Placed by rep: ${REP_NAME}`,
          notes ? `Notes: ${notes}` : ''
        ].filter(Boolean).join('\n'),
        note_attributes: [
          { name: 'order_type', value: 'pharmacy_rep' },
          { name: 'payment_terms', value: 'Net 30' },
          { name: 'rep_name', value: REP_NAME }
        ]
      }
    };

    const draftRes = await fetch(
      `https://${STORE}/admin/api/${API_VER}/draft_orders.json`,
      {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(draftBody)
      }
    );
    const draftData = await draftRes.json();
    if (!draftRes.ok || !draftData.draft_order) {
      console.error('Draft order error:', JSON.stringify(draftData));
      return res.status(500).json({ error: 'Could not create draft order.' });
    }
    const draftId = draftData.draft_order.id;

    // ─── 2. Complete draft order with payment pending (Net 30) ────────────
    const completeRes = await fetch(
      `https://${STORE}/admin/api/${API_VER}/draft_orders/${draftId}/complete.json?payment_pending=true`,
      {
        method: 'PUT',
        headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' }
      }
    );
    const completeData = await completeRes.json();
    if (!completeRes.ok || !completeData.draft_order?.order_id) {
      // Still a success - draft was created even if completion had issues
      return res.json({ orderName: `#DRAFT-${draftId}`, draftId });
    }

    const orderId = completeData.draft_order.order_id;

    // ─── 3. Get the order number ──────────────────────────────────────────
    const orderRes = await fetch(
      `https://${STORE}/admin/api/${API_VER}/orders/${orderId}.json?fields=id,name,order_number`,
      { headers: { 'X-Shopify-Access-Token': TOKEN } }
    );
    const orderData = await orderRes.json();
    const orderName = orderData.order?.name || `#${orderId}`;

    return res.json({ success: true, orderName, orderId });

  } catch (err) {
    console.error('Place order error:', err);
    return res.status(500).json({ error: 'Server error. Try again.' });
  }
}
