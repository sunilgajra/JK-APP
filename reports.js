import { state, buyerName, supplierName } from "./state.js";
import { esc, fmtMoney } from "./utils.js";
import { render } from "./ui.js";

export function reportsView() {
  const deals = state.deals || [];
  
  return `
    <div class="card">
      <div class="title mb-12">Reports & Analytics</div>
      
      <div class="grid grid-2 gap-20">
        <div class="item">
          <div class="form-header">Quick Summary</div>
          <div class="item-sub">Total Active Deals: <strong>${deals.filter(d => d.status === "active").length}</strong></div>
          <div class="item-sub">Total Value (USD): <strong>$${fmtMoney(deals.reduce((a, b) => a + (b.total_amount_usd || 0), 0))}</strong></div>
        </div>
        
        <div class="item">
          <div class="form-header">Filters</div>
          <select id="report-type">
            <option value="deals">Deals Report</option>
            <option value="payments">Payments Report</option>
          </select>
        </div>
      </div>
      
      <div id="report-results" class="mt-20">
         <div class="empty">Select a report type to view.</div>
      </div>
    </div>
  `;
}

export function bindReportsUI() {
  const type = document.getElementById("report-type");
  const results = document.getElementById("report-results");
  if (!type || !results) return;
  
  const generate = () => {
    const val = type.value;
    const deals = state.deals || [];
    
    if (val === "deals") {
      results.innerHTML = `
        <div class="table-responsive">
          <table class="report-table">
            <thead>
              <tr>
                <th>Deal No</th>
                <th>Date</th>
                <th>Product</th>
                <th>Buyer</th>
                <th>Supplier</th>
                <th>Total (USD)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${deals.map(d => `
                <tr>
                  <td>${esc(d.deal_no)}</td>
                  <td>${esc(d.deal_date)}</td>
                  <td>${esc(d.product_name)}</td>
                  <td>${buyerName(d.buyer_id)}</td>
                  <td>${supplierName(d.supplier_id)}</td>
                  <td>$${fmtMoney(d.total_amount_usd)}</td>
                  <td>${esc(d.status)}</td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5">Total</td>
                <td colspan="2">$${fmtMoney(deals.reduce((a, b) => a + (b.total_amount_usd || 0), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    } else if (val === "payments") {
      const allPayments = [];
      Object.entries(state.paymentsByDeal).forEach(([dealId, pms]) => {
        const deal = deals.find(d => String(d.id) === String(dealId));
        pms.forEach(p => allPayments.push({ ...p, deal_no: deal?.deal_no || "N/A" }));
      });
      allPayments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

      results.innerHTML = `
        <div class="table-responsive">
          <table class="report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Deal</th>
                <th>Direction</th>
                <th>Amount</th>
                <th>Currency</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              ${allPayments.map(p => `
                <tr>
                  <td>${esc(p.payment_date)}</td>
                  <td>${esc(p.deal_no)}</td>
                  <td style="color:${p.direction === "in" ? "var(--success)" : "var(--danger)"}">${esc(p.direction === "in" ? "IN (Received)" : "OUT (Sent)")}</td>
                  <td>${fmtMoney(p.amount)}</td>
                  <td>${esc(p.currency)}</td>
                  <td>${esc(p.reference_no)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }
  };

  type.addEventListener("change", generate);
  generate();
}

