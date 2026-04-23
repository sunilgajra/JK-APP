import { state, paymentsForDeal } from "../state.js";
import { esc } from "../utils.js";

export function dashboardView() {
  const totalDeals = state.deals.length;
  const totalBuyers = state.buyers.length;
  const totalSuppliers = state.suppliers.length;

  const totalValueAed = state.deals.reduce(
    (sum, d) => sum + Number(d.total_amount_aed || d.total_amount || 0),
    0
  );

  const totalReceivedAed = state.deals.reduce((sum, d) => {
    const payments = paymentsForDeal(d.id);
    const dealCurrency = d.document_currency || d.currency || d.base_currency || "AED";
    const conv = Number(d.conversion_rate || 0);

    const receivedAed = payments.reduce((acc, p) => {
      if (p.direction !== "in") return acc;

      const amount = Number(p.amount || 0);
      const paymentCurrency = p.currency || dealCurrency;

      if (paymentCurrency === "AED") return acc + amount;
      if (paymentCurrency === "USD") return acc + (conv > 0 ? amount * conv : 0);
      return acc;
    }, 0);

    return sum + receivedAed;
  }, 0);

  const activeDeals = state.deals.filter(
    (d) => (d.status || "").toLowerCase() !== "completed"
  ).length;

  const recentDeals = [...state.deals].slice(0, 5);

  return `
    <div class="grid grid-2">
      <div class="card">
        <div class="stat-label">Total Deals</div>
        <div class="stat-value">${totalDeals}</div>
        <div class="item-sub">Active: ${activeDeals}</div>
      </div>

      <div class="card">
        <div class="stat-label">Total Value</div>
        <div class="stat-value" style="font-size:20px">AED ${totalValueAed.toLocaleString("en-IN")}</div>
        <div class="item-sub">Across all deals</div>
      </div>

      <div class="card">
        <div class="stat-label">Received Payments</div>
        <div class="stat-value" style="font-size:20px;color:#22c55e">AED ${totalReceivedAed.toLocaleString("en-IN")}</div>
        <div class="item-sub">Payments received</div>
      </div>

      <div class="card">
        <div class="stat-label">Network</div>
        <div class="stat-value" style="font-size:20px">${totalBuyers + totalSuppliers}</div>
        <div class="item-sub">${totalBuyers} buyers · ${totalSuppliers} suppliers</div>
      </div>
    </div>

    <div class="card mt-14">
      <div class="flex flex-between flex-center gap-12 flex-wrap">
        <div class="title mb-0">Recent Deals</div>
        <button id="open-company-settings">Company Settings</button>
      </div>

      <div class="list mt-14">
        ${
          recentDeals.length
            ? recentDeals.map((d) => {
                const dealCurrency = d.document_currency || d.currency || d.base_currency || "AED";
                const displayTotal =
                  dealCurrency === "USD"
                    ? Number(d.total_amount_usd || d.total_amount || 0)
                    : Number(d.total_amount_aed || d.total_amount || 0);

                const payments = paymentsForDeal(d.id);
                const received = payments.reduce((acc, p) => {
                  if (p.direction !== "in") return acc;
                  return acc + Number(p.amount || 0);
                }, 0);

                return `
              <div class="item" style="padding:14px">
                <div class="flex flex-between gap-12 flex-wrap" style="align-items:flex-start">
                  <div style="min-width:0;flex:1">
                    <div class="item-title">${esc(d.deal_no || "—")} · ${esc(d.product_name || "—")}</div>
                    <div class="item-sub">HSN: ${esc(d.hsn_code || "—")}</div>
                    <div class="item-sub">${esc(d.loading_port || "—")} → ${esc(d.discharge_port || "—")}</div>
                    <div class="item-sub">${esc(d.type || "sell")} · ${esc(d.status || "active")}</div>
                  </div>
                  <div style="text-align:right;min-width:150px">
                    <div style="font-size:15px;font-weight:800;color:#d4a646">${esc(dealCurrency)} ${displayTotal.toLocaleString("en-IN")}</div>
                    <div class="item-sub">Received: ${esc(dealCurrency)} ${received.toLocaleString("en-IN")}</div>
                  </div>
                </div>
              </div>
            `;
              }).join("")
            : `<div class="empty">No deals available.</div>`
        }
      </div>
    </div>
  `;
}
