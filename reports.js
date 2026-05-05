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
  if (!type) return;
  
  type.addEventListener("change", () => {
    // Report generation logic...
  });
}
