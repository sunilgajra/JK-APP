import { state, buyerName, supplierName, paymentSummary } from "./state.js";
import { esc, fmtMoney } from "./utils.js";

export function reportsView() {
  const buyers = state.buyers || [];
  const suppliers = state.suppliers || [];

  return `
    <div class="card">
      <div class="title mb-12">Business Intelligence Reports</div>
      
      <form id="report-config-form" class="flex flex-column gap-16 p-10" style="background:rgba(255,255,255,0.02); border-radius:8px">
        <div class="grid grid-3 gap-14">
          <div>
            <label class="form-label">📊 Report Type</label>
            <select name="report_type" id="report-type-select">
              <option value="all">General (All Deals)</option>
              <option value="buyer">Buyer Wise</option>
              <option value="supplier">Supplier Wise</option>
            </select>
          </div>
          <div>
            <label class="form-label">📅 Date From</label>
            <input type="date" name="date_from">
          </div>
          <div>
            <label class="form-label">📅 Date To</label>
            <input type="date" name="date_to">
          </div>
        </div>

        <div id="buyer-select-wrap" style="display:none; background:rgba(0,0,0,0.2); padding:15px; border-radius:8px; border:1px solid var(--border)">
          <label class="form-label" style="color:var(--accent-primary)">👥 Select Buyers (Pick as many as you wish)</label>
          <div class="flex gap-12 flex-wrap mt-8" style="max-height:150px; overflow-y:auto">
            ${buyers.map(b => `
              <label class="flex flex-center gap-8 text-xs p-8" style="min-width:180px; background:rgba(255,255,255,0.03); border-radius:4px; cursor:pointer">
                <input type="checkbox" name="buyer_ids" value="${b.id}"> ${esc(b.name)}
              </label>
            `).join("")}
          </div>
        </div>

        <div id="supplier-select-wrap" style="display:none; background:rgba(0,0,0,0.2); padding:15px; border-radius:8px; border:1px solid var(--border)">
          <label class="form-label" style="color:var(--accent-primary)">🏢 Select Suppliers (Pick as many as you wish)</label>
          <div class="flex gap-12 flex-wrap mt-8" style="max-height:150px; overflow-y:auto">
            ${suppliers.map(s => `
              <label class="flex flex-center gap-8 text-xs p-8" style="min-width:180px; background:rgba(255,255,255,0.03); border-radius:4px; cursor:pointer">
                <input type="checkbox" name="supplier_ids" value="${s.id}"> ${esc(s.name)}
              </label>
            `).join("")}
          </div>
        </div>

        <div style="background:rgba(0,0,0,0.1); padding:15px; border-radius:8px">
          <label class="form-label">📋 Include Details (Columns)</label>
          <div class="flex gap-8 flex-wrap mt-8" style="max-height:200px; overflow-y:auto">
            ${[
              {v:"deal_no", l:"Deal No", c:true}, {v:"type", l:"Type"}, {v:"date", l:"Date", c:true}, 
              {v:"product", l:"Product", c:true}, {v:"hsn", l:"HSN Code"}, {v:"buyer", l:"Buyer", c:true}, 
              {v:"supplier", l:"Supplier", c:true}, {v:"qty", l:"Qty", c:true}, {v:"unit", l:"Unit"}, 
              {v:"sale_rate", l:"Sale Rate"}, {v:"purchase_rate", l:"Purchase Rate"}, {v:"sale_total", l:"Sale Total", c:true}, 
              {v:"vessel", l:"Vessel"}, {v:"loading_port", l:"Loading Port"}, {v:"discharge_port", l:"Discharge Port"}, 
              {v:"container_count", l:"Containers Count"}, {v:"received_bank", l:"Rec. Bank (Inv)"}, {v:"received_yard", l:"Rec. Yard/Token"}, 
              {v:"sent_bank", l:"Paid Bank (Inv)"}, {v:"sent_yard", l:"Paid Yard/Token"}, {v:"sale_inv_total", l:"Sale Inv. Amt"}, 
              {v:"sale_yard_total", l:"Sale Yard Amt"}, {v:"bal_inv_buyer", l:"Bal. Inv (Buyer)"}, {v:"bal_yard_buyer", l:"Bal. Yard (Buyer)"}, 
              {v:"bal_total_buyer", l:"Total Bal (Buyer)"}, {v:"purchase_inv_total", l:"Pur. Inv. Amt"}, {v:"purchase_yard_total", l:"Pur. Yard Amt"}, 
              {v:"bal_inv_supplier", l:"Bal. Inv (Sup)"}, {v:"bal_yard_supplier", l:"Bal. Yard (Sup)"}, {v:"bal_total_supplier", l:"Total Bal (Sup)"}, 
              {v:"bl_no", l:"BL No"}, {v:"status", l:"Status"}, {v:"origin", l:"Origin"}, {v:"commission_total", l:"Commission"}
            ].map(col => `
              <label class="flex flex-center gap-8 text-xs p-6" style="min-width:145px; background:rgba(255,255,255,0.02); border-radius:4px; cursor:pointer">
                <input type="checkbox" name="cols" value="${col.v}" ${col.c ? 'checked' : ''}> ${col.l}
              </label>
            `).join("")}
          </div>
        </div>

        <div class="flex gap-12 mt-10">
          <button type="submit" class="btn-primary" style="padding: 12px 24px; font-weight: 700">Generate Report</button>
          <button type="button" id="export-report-csv" class="btn-outline" style="padding: 12px 24px">Export to CSV</button>
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
  const buyerIds = fd.getAll("buyer_ids");
  const supplierIds = fd.getAll("supplier_ids");
  const dateFrom = fd.get("date_from");
  const dateTo = fd.get("date_to");
  const selectedCols = fd.getAll("cols");

  let deals = state.deals || [];

  // Filters
  if (type === "buyer" && buyerIds.length > 0) {
    deals = deals.filter(d => buyerIds.includes(String(d.is_high_seas ? d.high_seas_buyer_id : d.buyer_id)));
  }
  if (type === "supplier" && supplierIds.length > 0) {
    deals = deals.filter(d => supplierIds.includes(String(d.supplier_id)));
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
  let tRecBank = 0, tRecYard = 0, tSentBank = 0, tSentYard = 0;
  let tBalInvBuyer = 0, tBalYardBuyer = 0, tBalInvSup = 0, tBalYardSup = 0;
  let tBalTotalBuyer = 0, tBalTotalSup = 0;
  let tSaleInv = 0, tSaleYard = 0, tPurInv = 0, tPurYard = 0, totalContainers = 0;

  const rows = deals.map(d => {
    const list = state.paymentsByDeal[String(d.id)] || [];
    let recBank = 0, recYard = 0, sentBank = 0, sentYard = 0;

    const dealCurrency = d.document_currency || d.currency || d.base_currency || "AED";
    const dealConv = Number(d.conversion_rate || 3.67);

    list.forEach(p => {
      const hasConverted = p.converted_amount !== null && p.converted_amount !== undefined;
      const pAmt = Number(p.amount || 0);
      const pCurr = p.currency || "AED";

      // SELF-HEALING
      const isSuspicious = hasConverted && Number(p.converted_amount) === pAmt && pCurr !== dealCurrency;

      let val = 0;
      if (hasConverted && !isSuspicious) {
        val = Number(p.converted_amount);
      } else {
        if (pCurr === dealCurrency) val = pAmt;
        else if (pCurr === "AED" && dealCurrency === "USD") val = pAmt / dealConv;
        else if (pCurr === "USD" && dealCurrency === "AED") val = pAmt * dealConv;
        else val = pAmt;
      }
      
      const isBank = (p.method || "").toLowerCase().includes("bank");
      
      if (p.direction === "out") {
        if (isBank) sentBank += val;
        else sentYard += val;
      } else {
        if (isBank) recBank += val;
        else recYard += val;
      }
    });

    const s = paymentSummary(d.id, d.total_amount_aed, d.purchase_total_aed, "AED");
    const profit = s.sale - s.purchase;
    const margin = s.sale > 0 ? (profit / s.sale) * 100 : 0;
    
    totalSale += s.sale;
    totalPurchase += s.purchase;
    totalProfit += profit;
    totalQty += Number(d.quantity || 0);

    const qty = Number(d.quantity || 0);
    const saleInvTotal = qty * Number(d.sale_invoice_rate_aed || 0);
    const saleYardTotal = qty * Number(d.sale_yard_rate_aed || 0);
    const purInvTotal = qty * Number(d.purchase_invoice_rate_aed || 0);
    const purYardTotal = qty * Number(d.purchase_yard_rate_aed || 0);

    // Robust Container Count
    let cCount = 0;
    if (Array.isArray(d.container_numbers)) {
      cCount = d.container_numbers.length;
    } else if (typeof d.container_numbers === "string" && d.container_numbers.trim()) {
      if (d.container_numbers.startsWith("[")) {
        try {
          const parsed = JSON.parse(d.container_numbers);
          if (Array.isArray(parsed)) cCount = parsed.length;
        } catch(e) {
          cCount = d.container_numbers.split(/[,\n]+/).filter(x => x.trim()).length;
        }
      } else {
        cCount = d.container_numbers.split(/[,\n]+/).filter(x => x.trim()).length;
      }
    }

    const balInvBuyer = saleInvTotal - recBank;
    const balYardBuyer = saleYardTotal - recYard;
    const balInvSup = purInvTotal - sentBank;
    const balYardSup = purYardTotal - sentYard;

    tRecBank += recBank; tRecYard += recYard;
    tSentBank += sentBank; tSentYard += sentYard;
    tBalInvBuyer += balInvBuyer; tBalYardBuyer += balYardBuyer;
    tBalInvSup += balInvSup; tBalYardSup += balYardSup;
    tBalTotalBuyer += (balInvBuyer + balYardBuyer);
    tBalTotalSup += (balInvSup + balYardSup);
    tSaleInv += saleInvTotal; tSaleYard += saleYardTotal;
    tPurInv += purInvTotal; tPurYard += purYardTotal;
    totalContainers += cCount;

    return {
      deal_no: d.deal_no,
      type: d.type,
      date: d.invoice_date || d.created_at?.split("T")[0],
      product: d.product_name,
      hsn: d.hsn_code,
      buyer: d.is_high_seas ? buyerName(d.high_seas_buyer_id) : buyerName(d.buyer_id),
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
      container_count: cCount,
      received_bank: recBank,
      received_yard: recYard,
      sent_bank: sentBank,
      sent_yard: sentYard,
      sale_inv_total: saleInvTotal,
      sale_yard_total: saleYardTotal,
      bal_inv_buyer: balInvBuyer,
      bal_yard_buyer: balYardBuyer,
      bal_total_buyer: balInvBuyer + balYardBuyer,
      purchase_inv_total: purInvTotal,
      purchase_yard_total: purYardTotal,
      bal_inv_supplier: balInvSup,
      bal_yard_supplier: balYardSup,
      bal_total_supplier: balInvSup + balYardSup,
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
          ${selectedCols.map(c => `<th>${c.replace(/_/g, " ").toUpperCase()}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            ${selectedCols.map(c => `<td>${r[c] !== undefined ? (typeof r[c] === 'number' && c !== 'qty' && c !== 'container_count' ? fmtMoney(r[c]) : esc(r[c])) : "—"}</td>`).join("")}
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
            if (c === "received_bank") return `<td>${fmtMoney(tRecBank)}</td>`;
            if (c === "received_yard") return `<td>${fmtMoney(tRecYard)}</td>`;
            if (c === "sent_bank") return `<td>${fmtMoney(tSentBank)}</td>`;
            if (c === "sent_yard") return `<td>${fmtMoney(tSentYard)}</td>`;
            if (c === "bal_inv_buyer") return `<td>${fmtMoney(tBalInvBuyer)}</td>`;
            if (c === "bal_yard_buyer") return `<td>${fmtMoney(tBalYardBuyer)}</td>`;
            if (c === "bal_total_buyer") return `<td>${fmtMoney(tBalTotalBuyer)}</td>`;
            if (c === "bal_inv_supplier") return `<td>${fmtMoney(tBalInvSup)}</td>`;
            if (c === "bal_yard_supplier") return `<td>${fmtMoney(tBalYardSup)}</td>`;
            if (c === "bal_total_supplier") return `<td>${fmtMoney(tBalTotalSup)}</td>`;
            if (c === "sale_inv_total") return `<td>${fmtMoney(tSaleInv)}</td>`;
            if (c === "sale_yard_total") return `<td>${fmtMoney(tSaleYard)}</td>`;
            if (c === "purchase_inv_total") return `<td>${fmtMoney(tPurInv)}</td>`;
            if (c === "purchase_yard_total") return `<td>${fmtMoney(tPurYard)}</td>`;
            if (c === "container_count") return `<td>${totalContainers}</td>`;
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
