import { state, buyerName, supplierName, paymentSummary } from "./state.js";
import { esc, fmtMoney } from "./utils.js";

export function reportsView() {
  const buyers = state.buyers || [];
  const suppliers = state.suppliers || [];

  return `
    <div class="card">
      <div class="title mb-12">Business Intelligence Reports</div>
      
      <form id="report-config-form" class="grid gap-12 p-10" style="background:rgba(255,255,255,0.02); border-radius:8px">
        <div class="grid grid-3 gap-10">
          <div>
            <label class="form-label">Report Type</label>
            <select name="report_type" id="report-type-select">
              <option value="all">General (All Deals)</option>
              <option value="buyer">Buyer Wise</option>
              <option value="supplier">Supplier Wise</option>
            </select>
          </div>
          <div id="buyer-select-wrap" style="display:none">
            <label class="form-label">Select Buyer</label>
            <select name="buyer_id">
              <option value="">All Buyers</option>
              ${buyers.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}
            </select>
          </div>
          <div id="supplier-select-wrap" style="display:none">
            <label class="form-label">Select Supplier</label>
            <select name="supplier_id">
              <option value="">All Suppliers</option>
              ${suppliers.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}
            </select>
          </div>
          <div>
            <label class="form-label">Date From</label>
            <input type="date" name="date_from">
          </div>
          <div>
            <label class="form-label">Date To</label>
            <input type="date" name="date_to">
          </div>
        </div>

        <div class="mt-10">
          <label class="form-label">Include Details (Columns)</label>
          <div class="flex gap-12 flex-wrap" style="background:rgba(0,0,0,0.2); padding:10px; border-radius:4px; max-height:200px; overflow-y:auto">
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="deal_no" checked> Deal No</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="type"> Type</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="date" checked> Date</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="product" checked> Product</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="hsn"> HSN Code</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="buyer" checked> Buyer</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="supplier" checked> Supplier</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="qty" checked> Qty</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="unit"> Unit</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="sale_rate"> Sale Rate</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="purchase_rate"> Purchase Rate</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="sale_total" checked> Sale Total</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="purchase_total" checked> Purchase Total</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="profit" checked> Profit</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="margin" checked> Margin %</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="loading_port"> Loading Port</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="discharge_port"> Discharge Port</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="vessel"> Vessel</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="eta"> ETA</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="bl_no"> BL No</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="status"> Status</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="shipment_status"> Ship Status</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="origin"> Origin</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="gross_weight"> Gross Wt</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="net_weight"> Net Wt</label>
            <label class="flex flex-center gap-8 text-xs"><input type="checkbox" name="cols" value="commission_total"> Commission</label>
          </div>
        </div>

        <div class="flex gap-10 mt-10">
          <button type="submit" class="btn-primary">Generate Report</button>
          <button type="button" id="export-report-csv" class="btn-outline">Export to CSV</button>
        </div>
      </form>

      <div id="report-results" class="mt-14" style="overflow-x:auto">
        <div class="empty">Configure and generate a report to see data.</div>
      </div>
    </div>
  `;
}

export function bindReportsUI() {
  const typeSelect = document.getElementById("report-type-select");
  if (typeSelect) {
    typeSelect.addEventListener("change", (e) => {
      document.getElementById("buyer-select-wrap").style.display = e.target.value === "buyer" ? "block" : "none";
      document.getElementById("supplier-select-wrap").style.display = e.target.value === "supplier" ? "block" : "none";
    });
  }

  document.getElementById("report-config-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    renderReport();
  });

  document.getElementById("export-report-csv")?.addEventListener("click", exportReportCsv);
}

function renderReport() {
  const form = document.getElementById("report-config-form");
  if (!form) return;
  const fd = new FormData(form);
  
  const type = fd.get("report_type");
  const buyerId = fd.get("buyer_id");
  const supplierId = fd.get("supplier_id");
  const dateFrom = fd.get("date_from");
  const dateTo = fd.get("date_to");
  const selectedCols = fd.getAll("cols");

  let deals = state.deals || [];

  // Filters
  if (type === "buyer" && buyerId) {
    deals = deals.filter(d => String(d.buyer_id) === String(buyerId));
  }
  if (type === "supplier" && supplierId) {
    deals = deals.filter(d => String(d.supplier_id) === String(supplierId));
  }
  if (dateFrom) {
    deals = deals.filter(d => (d.invoice_date || d.created_at) >= dateFrom);
  }
  if (dateTo) {
    deals = deals.filter(d => (d.invoice_date || d.created_at) <= dateTo);
  }

  const resultsWrap = document.getElementById("report-results");
  if (!deals.length) {
    resultsWrap.innerHTML = `<div class="empty">No data found for the selected criteria.</div>`;
    return;
  }

  // Calculate Totals
  let totalSale = 0, totalPurchase = 0, totalProfit = 0, totalQty = 0;

  const rows = deals.map(d => {
    const s = paymentSummary(d.id, d.total_amount_aed, d.purchase_total_aed);
    const profit = s.sale - s.purchase;
    const margin = s.sale > 0 ? (profit / s.sale) * 100 : 0;
    
    totalSale += s.sale;
    totalPurchase += s.purchase;
    totalProfit += profit;
    totalQty += Number(d.quantity || 0);

    return {
      deal_no: d.deal_no,
      type: d.type,
      date: d.invoice_date || d.created_at?.split("T")[0],
      product: d.product_name,
      hsn: d.hsn_code,
      buyer: buyerName(d.buyer_id),
      supplier: supplierName(d.supplier_id),
      qty: d.quantity,
      unit: d.unit,
      sale_rate: d.rate,
      purchase_rate: d.purchase_rate,
      sale_total: s.sale,
      purchase_total: s.purchase,
      profit: profit,
      margin: margin.toFixed(2) + "%",
      loading_port: d.loading_port,
      discharge_port: d.discharge_port,
      vessel: d.vessel_voyage || d.vessel,
      eta: d.eta,
      bl_no: d.bl_no,
      status: d.status,
      shipment_status: d.shipment_status,
      origin: d.country_of_origin,
      gross_weight: d.gross_weight,
      net_weight: d.net_weight,
      commission_total: d.commission_total
    };
  });

  const tableHtml = `
    <table class="report-table">
      <thead>
        <tr>
          ${selectedCols.map(c => `<th>${c.replace("_", " ").toUpperCase()}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            ${selectedCols.map(c => `<td>${r[c] !== undefined ? (typeof r[c] === 'number' && c !== 'qty' ? fmtMoney(r[c]) : esc(r[c])) : "—"}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
      <tfoot>
        <tr style="background:rgba(255,255,255,0.05); font-weight:bold">
          ${selectedCols.map(c => {
            if (c === "sale_total") return `<td>${fmtMoney(totalSale)}</td>`;
            if (c === "purchase_total") return `<td>${fmtMoney(totalPurchase)}</td>`;
            if (c === "profit") return `<td>${fmtMoney(totalProfit)}</td>`;
            if (c === "qty") return `<td>${fmtMoney(totalQty)}</td>`;
            if (c === "deal_no") return `<td>TOTAL (${rows.length})</td>`;
            return `<td></td>`;
          }).join("")}
        </tr>
      </tfoot>
    </table>
  `;

  resultsWrap.innerHTML = tableHtml;
}

function exportReportCsv() {
  const table = document.querySelector(".report-table");
  if (!table) return alert("Please generate a report first.");

  let csv = [];
  const rows = table.querySelectorAll("tr");
  
  for (let i = 0; i < rows.length; i++) {
    const row = [], cols = rows[i].querySelectorAll("td, th");
    for (let j = 0; j < cols.length; j++) {
      let data = cols[j].innerText.replace(/,/g, "").replace(/\n/g, " ");
      row.push('"' + data + '"');
    }
    csv.push(row.join(","));
  }

  const csvContent = "data:text/csv;charset=utf-8," + csv.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `JK_Report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
