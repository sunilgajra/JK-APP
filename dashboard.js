import { state, paymentSummary, buyerName } from "./state.js";
import { esc, fmtMoney } from "./utils.js";

export function dashboardView() {
  const activeDeals = state.deals.filter(d => d.status === 'active');
  
  let totalReceivable = 0;
  let totalPayable = 0;
  
  activeDeals.forEach(d => {
    const s = paymentSummary(d.id, d.total_amount_usd, d.purchase_total_usd);
    totalReceivable += s.receivable;
    totalPayable += s.payable;
  });

  return `
    <div class="grid">
      <h2 class="title">DASHBOARD</h2>
      
      <div class="grid grid-2">
        <div class="card">
          <div class="stat-label">Total Receivable (USD)</div>
          <div class="stat-value" style="color:var(--success)">$ ${fmtMoney(totalReceivable)}</div>
        </div>
        <div class="card">
          <div class="stat-label">Total Payable (USD)</div>
          <div class="stat-value" style="color:var(--danger)">$ ${fmtMoney(totalPayable)}</div>
        </div>
      </div>

      <div class="card">
        <div class="title mb-12">ACTIVE DEALS (${activeDeals.length})</div>
        <div class="list">
          ${activeDeals.slice(0, 5).map(d => `
            <div class="item flex-between flex-center" data-open-deal="${d.id}" style="cursor:pointer">
              <div>
                <div class="item-title">${esc(d.deal_no)}: ${esc(d.product_name)}</div>
                <div class="item-sub">${esc(buyerName(d.buyer_id))}</div>
              </div>
              <div style="font-weight:800; font-size:12px; color:var(--accent)">OPEN ></div>
            </div>
          `).join("")}
          ${activeDeals.length > 5 ? `<div class="item-sub" style="text-align:center">And ${activeDeals.length - 5} more...</div>` : ""}
        </div>
      </div>
    </div>
  `;
}
