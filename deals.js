import { state, buyerName, supplierName, paymentSummary, paymentsForDeal, documentsForDeal } from "./state.js";
import { esc, nextDealNo, fmtMoney } from "./utils.js";

export function dealsView() {
  const q = state.dealSearch.trim().toLowerCase();
  const filteredDeals = state.deals.filter((d) => {
    if (!q) return true;
    const buyer = buyerName(d.buyer_id).toLowerCase();
    const supplier = supplierName(d.supplier_id).toLowerCase();
    const text = [
      d.deal_no,
      d.product_name,
      d.hsn_code,
      d.loading_port,
      d.discharge_port,
      d.status,
      d.type,
      buyer,
      supplier
    ].join(" ").toLowerCase();
    return text.includes(q);
  });

  return `
    <div class="fade-in">
      <div class="flex justify-between items-center mb-24">
        <h1 style="font-size: 24px; font-weight: 800;">Trade Deals</h1>
        <div class="flex gap-12">
          <button id="export-deals-csv" class="btn btn-outline">Export CSV</button>
          <button id="show-deal-form" class="btn btn-primary">+ Create Deal</button>
        </div>
      </div>

      <div class="search-container">
        <span style="position: absolute; left: 16px; top: 14px; opacity: 0.5;">🔍</span>
        <input id="deal-search" class="search-input" value="${esc(state.dealSearch || "")}" placeholder="Search deals by No, Product, Buyer, Supplier or Route..." />
      </div>

      <div id="deal-form-wrap"></div>

      <div class="grid grid-2">
        ${filteredDeals.length ? filteredDeals.map((d) => {
          const s = paymentSummary(d.id, d.total_amount, d.document_currency === "USD" ? d.purchase_total_usd : d.purchase_total_aed);
          const curr = d.document_currency || d.currency || "AED";
          const profit = s.sale - s.purchase;
          const margin = s.sale > 0 ? (profit / s.sale) * 100 : 0;
          const statusClass = d.status === 'active' ? 'badge-active' : 'badge-draft';

          return `
            <div class="card item fade-in" style="display: flex; flex-direction: column;">
              <div class="flex justify-between items-start mb-16">
                <div>
                  <div class="flex items-center gap-8">
                    <span class="item-title" style="font-size: 18px; color: var(--primary);">${esc(d.deal_no)}</span>
                    <span class="deal-badge ${statusClass}">${esc(d.status)}</span>
                  </div>
                  <div class="item-sub" style="font-weight: 700; color: var(--text-main); margin-top: 4px;">${esc(d.product_name)}</div>
                  <div class="item-sub">${esc(d.loading_port)} → ${esc(d.discharge_port)}</div>
                </div>
                <div style="text-align: right">
                  <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Margin</div>
                  <div style="font-size: 18px; font-weight: 800; color: var(--success);">${margin.toFixed(1)}%</div>
                </div>
              </div>

              <div class="grid grid-2 gap-12 mb-16 p-12" style="background: rgba(0,0,0,0.2); border-radius: 10px;">
                <div>
                  <span class="stat-label" style="font-size: 9px; color: var(--success)">Receivable</span>
                  <div style="font-weight: 800; font-size: 14px;">${curr} ${fmtMoney(s.receivable)}</div>
                </div>
                <div>
                  <span class="stat-label" style="font-size: 9px; color: var(--danger)">Payable</span>
                  <div style="font-weight: 800; font-size: 14px;">${curr} ${fmtMoney(s.payable)}</div>
                </div>
              </div>

              <div class="item-sub mb-16">
                <b>Buyer:</b> ${esc(buyerName(d.buyer_id))} <br/>
                <b>Supplier:</b> ${esc(supplierName(d.supplier_id))}
              </div>

              <div class="mt-auto pt-16 flex gap-8" style="border-top: 1px solid var(--border);">
                <button data-open-deal="${d.id}" class="btn btn-primary btn-small w-full">Open Dashboard</button>
                <button data-edit-deal="${d.id}" class="btn btn-outline btn-small">Edit</button>
                <button data-delete-deal="${d.id}" class="btn btn-logout btn-small">Delete</button>
              </div>
            </div>
          `;
        }).join("") : `<div class="empty card">No matching deals found.</div>`}
      </div>
    </div>
  `;
}

export function dealFormHtml(d = {}, edit = false, id = "") {
  const currentDocCurrency = d.document_currency || d.currency || "USD";

  return `
    <div class="card mb-24 fade-in" style="border: 1px solid var(--primary);">
      <h3 class="section-title">${edit ? "Update Trade Deal" : "Initialize New Trade Deal"}</h3>
      <form id="${edit ? `deal-edit-form-${id}` : "deal-form"}" class="grid gap-16">
        
        <div class="card" style="background: rgba(0,0,0,0.1);">
           <h4 class="item-title mb-12">📦 Basic Information</h4>
           <div class="grid grid-3 gap-16">
              <div class="form-group mb-0">
                <label>Deal Type</label>
                <select name="type" required>
                  <option value="sell" ${d.type === "sell" ? "selected" : ""}>Sell</option>
                  <option value="purchase" ${d.type === "purchase" ? "selected" : ""}>Purchase</option>
                </select>
              </div>
              <div class="form-group mb-0">
                <label>Deal Number</label>
                <input name="deal_no" value="${esc(d.deal_no || nextDealNo())}" required>
              </div>
              <div class="form-group mb-0">
                <label>Status</label>
                <select name="status">
                  <option value="active" ${d.status === "active" ? "selected" : ""}>Active</option>
                  <option value="shipped" ${d.status === "shipped" ? "selected" : ""}>Shipped</option>
                  <option value="invoiced" ${d.status === "invoiced" ? "selected" : ""}>Invoiced</option>
                  <option value="completed" ${d.status === "completed" ? "selected" : ""}>Completed</option>
                </select>
              </div>
           </div>
           
           <div class="grid grid-2 gap-16 mt-16">
              <div class="form-group mb-0">
                <label>Product</label>
                <select name="product_name" id="${edit ? `product-name-${id}` : "product-name"}" required>
                  <option value="">Select product</option>
                  ${(state.products || []).map((p) => `
                    <option value="${esc(p.name)}" data-hsn="${esc(p.hsn_code || "")}" ${d.product_name === p.name ? "selected" : ""}>${esc(p.name)}</option>
                  `).join("")}
                </select>
              </div>
              <div class="form-group mb-0">
                <label>HSN Code</label>
                <input name="hsn_code" id="${edit ? `hsn-code-${id}` : "hsn-code"}" value="${esc(d.hsn_code || "")}">
              </div>
           </div>
        </div>

        <div class="grid grid-2 gap-24">
           <div class="card" style="background: rgba(0,0,0,0.1);">
              <h4 class="item-title mb-12">🚢 Shipment Details</h4>
              <div class="grid grid-2 gap-12">
                 <div class="form-group mb-0"><label>Loading Port</label><input name="loading_port" value="${esc(d.loading_port || "")}"></div>
                 <div class="form-group mb-0"><label>Discharge Port</label><input name="discharge_port" value="${esc(d.discharge_port || "")}"></div>
                 <div class="form-group mb-0"><label>Vessel Name</label><input name="vessel" value="${esc(d.vessel || "")}"></div>
                 <div class="form-group mb-0"><label>Shipment Date</label><input name="shipment_out_date" type="date" value="${esc(d.shipment_out_date || "")}"></div>
              </div>
           </div>

           <div class="card" style="background: rgba(0,0,0,0.1);">
              <h4 class="item-title mb-12">💰 Financial Settings</h4>
              <div class="grid grid-2 gap-12">
                 <div class="form-group mb-0">
                    <label>Base Currency</label>
                    <select name="base_currency" id="${edit ? `base-currency-${id}` : "base-currency"}">
                      <option value="USD" ${(d.base_currency || "USD") === "USD" ? "selected" : ""}>USD</option>
                      <option value="AED" ${d.base_currency === "AED" ? "selected" : ""}>AED</option>
                    </select>
                 </div>
                 <div class="form-group mb-0">
                    <label>Doc Currency</label>
                    <select name="document_currency">
                      <option value="AED" ${currentDocCurrency === "AED" ? "selected" : ""}>AED</option>
                      <option value="USD" ${currentDocCurrency === "USD" ? "selected" : ""}>USD</option>
                    </select>
                 </div>
                 <div class="form-group mb-0"><label>Sale Rate</label><input name="rate" id="${edit ? `rate-${id}` : "rate"}" type="number" step="0.01" value="${esc(d.rate || "")}"></div>
                 <div class="form-group mb-0"><label>Purchase Rate</label><input name="purchase_rate" id="${edit ? `purchase-rate-${id}` : "purchase-rate"}" type="number" step="0.01" value="${esc(d.purchase_rate || "")}"></div>
                 <div class="form-group mb-0"><label>Quantity</label><input name="quantity" id="${edit ? `quantity-${id}` : "quantity"}" type="number" step="0.001" value="${esc(d.quantity || "")}"></div>
                 <div class="form-group mb-0"><label>Conv. Rate</label><input name="conversion_rate" id="${edit ? `conversion-rate-${id}` : "conversion-rate"}" type="number" step="0.0001" value="${esc(d.conversion_rate || "3.6725")}"></div>
              </div>
           </div>
        </div>

        <div class="flex gap-12 mt-12">
          <button type="submit" class="btn btn-primary">${edit ? "Update Deal" : "Create Deal"}</button>
          <button type="button" class="btn btn-outline" id="${edit ? `cancel-deal-edit-${id}` : "cancel-deal-form"}">Discard</button>
        </div>
      </form>
    </div>
  `;
}
