import { state, buyerName, supplierName, paymentSummary, paymentsForDeal, documentsForDeal } from "./state.js";
import { esc, nextDealNo, fmtMoney, cleanContainerNumbers, cleanUpper, cleanNumber, ensureDocNumbers } from "./utils.js";
import { supabase } from "./supabase.js";
import { loadSupabaseData, loadProducts } from "./data.js";
import { render } from "./ui.js";

export function dealsView() {
  const q = (state.dealSearch || "").trim().toLowerCase();
  const filter = state.dealStatusFilter || "all";
  
  const filteredDeals = state.deals.filter((d) => {
    const matchesSearch = !q || [d.deal_no, d.product_name, buyerName(d.buyer_id), supplierName(d.supplier_id), d.bl_no].join(" ").toLowerCase().includes(q);
    const matchesStatus = filter === "all" || d.status === filter;
    return matchesSearch && matchesStatus;
  });

  return `
    <div class="card">
      <div class="flex flex-between flex-center gap-12 mb-12 flex-wrap">
        <div class="title mb-0">Deals Management</div>
        <div class="flex gap-8">
          <button id="export-deals-csv" class="btn-outline">Export CSV</button>
          <button id="show-deal-form" class="btn-primary">New Deal</button>
        </div>
      </div>

      <div class="grid grid-2 gap-10 mb-12">
        <input id="deal-search" value="${esc(state.dealSearch || "")}" placeholder="Search by Deal No, Product, Buyer, Supplier..." />
        <select id="deal-status-filter">
          <option value="all" ${filter === "all" ? "selected" : ""}>All Statuses</option>
          <option value="active" ${filter === "active" ? "selected" : ""}>Active</option>
          <option value="closed" ${filter === "closed" ? "selected" : ""}>Closed</option>
          <option value="cancelled" ${filter === "cancelled" ? "selected" : ""}>Cancelled</option>
        </select>
      </div>

      <div id="deal-form-wrap"></div>

      <div class="list mt-12">
        ${
          filteredDeals.length
            ? filteredDeals.map((d) => `
          <div class="item">
            <div class="flex flex-between flex-top flex-wrap gap-12">
              <div style="flex: 1; min-width: 0">
                <div class="item-title" style="cursor:pointer" data-open-deal="${d.id}">${esc(d.deal_no)} · ${esc(d.product_name)}</div>
                <div class="item-sub">
                  Buyer: <strong>${esc(buyerName(d.buyer_id))}</strong> · Supplier: <strong>${esc(supplierName(d.supplier_id))}</strong>
                </div>
                <div class="item-sub">
                  Qty: ${esc(d.quantity)} ${esc(d.unit)} · Amount: ${esc(d.document_currency)} ${fmtMoney(d.total_amount)}
                </div>
                ${d.bl_no ? `<div class="item-sub">BL: ${esc(d.bl_no)} · Vessel: ${esc(d.vessel || "—")}</div>` : ""}
              </div>
              <div class="flex flex-col flex-end gap-8" style="min-width:140px">
                <span class="badge ${d.status === "active" ? "badge-success" : "badge-danger"}">${esc(d.status)}</span>
                <div class="flex gap-4">
                  <button data-open-deal="${d.id}" class="btn-xs btn-primary">Details</button>
                  <button data-edit-deal="${d.id}" class="btn-xs">Edit</button>
                  <button data-delete-deal="${d.id}" class="btn-xs text-danger">×</button>
                </div>
                <div class="flex gap-4">
                   <button data-high-seas="${d.id}" class="btn-xs btn-outline" style="font-size:9px">High Seas</button>
                </div>
              </div>
            </div>
            <div id="deal-edit-wrap-${d.id}" class="mt-10"></div>
            <div id="high-seas-form-wrap-${d.id}" class="mt-10"></div>
          </div>
        `).join("")
            : `<div class="empty">No deals found.</div>`
        }
      </div>
    </div>
  `;
}

export function dealFormHtml(d = {}, edit = false, id = "") {
  const isEdit = edit;
  const suffix = isEdit ? `-${id}` : "";
  const nextNo = nextDealNo();
  
  return `
    <form id="${isEdit ? `deal-edit-form-${id}` : "deal-form"}" class="item mb-12">
      <div class="form-header">${isEdit ? "Edit Deal" : "New Deal"}</div>
      <div class="grid grid-2 gap-10">
        <div>
          <label class="form-label">Deal No</label>
          <input name="deal_no" id="deal_no${suffix}" value="${esc(d.deal_no || nextNo)}" required>
        </div>
        <div>
          <label class="form-label">Type</label>
          <select name="type">
            <option value="direct" ${d.type === "direct" ? "selected" : ""}>Direct Export</option>
            <option value="local" ${d.type === "local" ? "selected" : ""}>Local Sale</option>
          </select>
        </div>
      </div>

      <div class="form-header mt-15">Product & Pricing</div>
      <div class="grid grid-2 gap-10">
        <div>
          <label class="form-label">Product Name</label>
          <select name="product_name" id="product-name${suffix}" required>
            <option value="">Select Product</option>
            ${state.products.map(p => `<option value="${p.name}" data-hsn="${p.hsn_code}" ${p.name === d.product_name ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="form-label">HSN Code</label>
          <input name="hsn_code" id="hsn-code${suffix}" value="${esc(d.hsn_code || "")}">
        </div>
        <div>
          <label class="form-label">Quantity (MT)</label>
          <input name="quantity" id="quantity${suffix}" type="number" step="0.001" value="${d.quantity || ""}" required>
        </div>
        <div>
          <label class="form-label">Unit</label>
          <input name="unit" value="${esc(d.unit || "MTON")}" required>
        </div>
      </div>

      <div class="grid grid-2 gap-10 mt-10">
         <div>
          <label class="form-label">Base Currency</label>
          <select name="base_currency" id="base-currency${suffix}">
            <option value="USD" ${d.base_currency === "USD" ? "selected" : ""}>USD</option>
            <option value="AED" ${d.base_currency === "AED" ? "selected" : ""}>AED</option>
          </select>
        </div>
        <div>
          <label class="form-label">Document Currency</label>
          <select name="document_currency" id="document_currency${suffix}">
            <option value="USD" ${d.document_currency === "USD" ? "selected" : ""}>USD</option>
            <option value="AED" ${d.document_currency === "AED" ? "selected" : ""}>AED</option>
          </select>
        </div>
      </div>

      <div class="grid grid-2 gap-20 mt-15">
        <div class="item p-10" style="background:rgba(16,185,129,0.05)">
          <div class="item-title mb-8" style="font-size:12px;color:var(--success)">Sale Pricing</div>
          <div class="grid grid-2 gap-8">
            <div>
              <label class="label-xs">Full Rate</label>
              <input name="rate" id="rate${suffix}" type="number" step="0.01" value="${d.rate || ""}" required>
            </div>
             <div>
              <label class="label-xs">Conv. Rate</label>
              <input name="sale_conversion_rate" id="sale-conv${suffix}" type="number" step="0.000001" value="${d.sale_conversion_rate || (d.base_currency === "USD" ? 3.6725 : 1)}">
            </div>
            <div>
              <label class="label-xs">Invoice Rate</label>
              <input name="sale_invoice_rate" id="sale-inv-rate${suffix}" type="number" step="0.01" value="${d.sale_invoice_rate || ""}">
            </div>
            <div>
              <label class="label-xs">Yard Rate</label>
              <input name="sale_yard_rate" id="sale-yard-rate${suffix}" type="number" step="0.01" value="${d.sale_yard_rate || ""}">
            </div>
            <div style="grid-column: span 2">
              <label class="label-xs">Total Sale (USD)</label>
              <input id="total${suffix}" type="number" step="0.01" value="${d.total_amount_usd || ""}" readonly style="background:rgba(0,0,0,0.2)">
            </div>
          </div>
        </div>

        <div class="item p-10" style="background:rgba(239,68,68,0.05)">
          <div class="item-title mb-8" style="font-size:12px;color:var(--danger)">Purchase Pricing</div>
          <div class="grid grid-2 gap-8">
            <div>
              <label class="label-xs">Full Rate</label>
              <input name="purchase_rate" id="purchase-rate${suffix}" type="number" step="0.01" value="${d.purchase_rate || ""}">
            </div>
            <div>
              <label class="label-xs">Conv. Rate</label>
              <input name="purchase_conversion_rate" id="purchase-conv${suffix}" type="number" step="0.000001" value="${d.purchase_conversion_rate || (d.base_currency === "USD" ? 3.6725 : 1)}">
            </div>
             <div>
              <label class="label-xs">Invoice Rate</label>
              <input name="purchase_invoice_rate" id="purchase-inv-rate${suffix}" type="number" step="0.01" value="${d.purchase_invoice_rate || ""}">
            </div>
            <div>
              <label class="label-xs">Yard Rate</label>
              <input name="purchase_yard_rate" id="purchase-yard-rate${suffix}" type="number" step="0.01" value="${d.purchase_yard_rate || ""}">
            </div>
            <div style="grid-column: span 2">
              <label class="label-xs">Total Purchase (USD)</label>
              <input id="purchase-total${suffix}" type="number" step="0.01" value="${d.purchase_total_usd || ""}" readonly style="background:rgba(0,0,0,0.2)">
            </div>
          </div>
        </div>
      </div>

      <div class="form-header mt-15">Parties</div>
      <div class="grid grid-2 gap-10">
        <div>
          <label class="form-label">Buyer</label>
          <select name="buyer_id">
            <option value="">Select Buyer</option>
            ${state.buyers.map(b => `<option value="${b.id}" ${String(b.id) === String(d.buyer_id) ? "selected" : ""}>${esc(b.name)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="form-label">Supplier</label>
          <select name="supplier_id">
            <option value="">Select Supplier</option>
            ${state.suppliers.map(s => `<option value="${s.id}" ${String(s.id) === String(d.supplier_id) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="form-header mt-15">Shipping Info</div>
      <div class="grid grid-2 gap-10">
        <div>
          <label class="form-label">BL No</label>
          <input name="bl_no" value="${esc(d.bl_no || "")}">
        </div>
        <div>
          <label class="form-label">Vessel</label>
          <input name="vessel" value="${esc(d.vessel || "")}">
        </div>
         <div>
          <label class="form-label">Loading Port</label>
          <input name="loading_port" value="${esc(d.loading_port || "")}">
        </div>
        <div>
          <label class="form-label">Discharge Port</label>
          <input name="discharge_port" value="${esc(d.discharge_port || "")}">
        </div>
         <div>
          <label class="form-label">ETA</label>
          <input name="eta" type="date" value="${d.eta || ""}">
        </div>
         <div>
          <label class="form-label">Status</label>
          <select name="status">
            <option value="active" ${d.status === "active" ? "selected" : ""}>Active</option>
            <option value="closed" ${d.status === "closed" ? "selected" : ""}>Closed</option>
            <option value="cancelled" ${d.status === "cancelled" ? "selected" : ""}>Cancelled</option>
          </select>
        </div>
      </div>

      <div class="form-header mt-15">Weights & Details</div>
      <div class="grid grid-3 gap-10">
        <div>
          <label class="form-label">Gross Weight (KG)</label>
          <input name="gross_weight" id="gross-weight${suffix}" type="number" step="0.01" value="${d.gross_weight || ""}">
        </div>
        <div>
          <label class="form-label">Net Weight (KG)</label>
          <input name="net_weight" id="net-weight${suffix}" type="number" step="0.01" value="${d.net_weight || ""}">
        </div>
        <div>
          <label class="form-label">Containers (One per line)</label>
          <textarea name="container_numbers" style="min-height:60px;font-size:11px">${(d.container_numbers || []).join("\n")}</textarea>
        </div>
      </div>

      <div class="flex gap-10 mt-20">
        <button type="submit" class="btn-primary">${isEdit ? "Update Deal" : "Save Deal"}</button>
        <button type="button" id="${isEdit ? `cancel-deal-edit-${id}` : "cancel-deal-form"}">Cancel</button>
      </div>
    </form>
  `;
}

export function highSeasFormHtml(d) {
  return `
    <form id="high-seas-form-${d.id}" class="item" style="border:2px solid var(--accent-primary)">
       <div class="form-header" style="color:var(--accent-primary)">High Seas Sale Configuration</div>
       <div class="item-sub mb-10">Transferring liability for Deal <strong>${esc(d.deal_no)}</strong> to another buyer.</div>
       <div class="grid gap-12">
          <div>
            <label class="form-label">New High Seas Buyer</label>
            <select name="high_seas_buyer_id" required>
              <option value="">Select High Seas Buyer</option>
              ${state.buyers.map(b => `<option value="${b.id}" ${String(b.id) === String(d.high_seas_buyer_id) ? "selected" : ""}>${esc(b.name)}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="item-sub" style="margin-top:0">
          * This will mark the deal as a High Seas Sale. The amount to be received will be tracked against the High Seas Buyer's name in statements, but the original buyer remains linked.
        </div>
        <div class="flex gap-10 mt-10">
          <button type="submit" class="btn-primary">Save High Seas Detail</button>
          <button type="button" id="cancel-high-seas-${d.id}">Cancel</button>
        </div>
      </div>
    </form>
  `;
}

// Deal Logic
export function validateDeal(fd) {
  const quantity = cleanNumber(fd.get("quantity"));
  const rate = cleanNumber(fd.get("rate")); // Sale Rate
  const pRate = cleanNumber(fd.get("purchase_rate")); // Purchase Rate
  const saleConv = cleanNumber(fd.get("sale_conversion_rate"));
  const purchaseConv = cleanNumber(fd.get("purchase_conversion_rate"));
  const baseCurr = fd.get("base_currency") || "USD";
  const docCurr = fd.get("document_currency") || baseCurr;

  let rateUsd = 0, rateAed = 0, totalUsd = 0, totalAed = 0;
  let pRateUsd = 0, pRateAed = 0, pTotalUsd = 0, pTotalAed = 0;

  if (baseCurr === "USD") {
    rateUsd = rate;
    rateAed = saleConv ? rate * saleConv : 0;
    pRateUsd = pRate;
    pRateAed = purchaseConv ? pRate * purchaseConv : 0;
  } else {
    rateAed = rate;
    rateUsd = saleConv ? rate / saleConv : 0;
    pRateAed = pRate;
    pRateUsd = purchaseConv ? pRate / purchaseConv : 0;
  }

  const round = (num) => Math.round((num + Number.EPSILON) * 100) / 100;
  
  const sInv = cleanNumber(fd.get("sale_invoice_rate"));
  const sYard = cleanNumber(fd.get("sale_yard_rate"));
  const pInv = cleanNumber(fd.get("purchase_invoice_rate"));
  const pYard = cleanNumber(fd.get("purchase_yard_rate"));

  let sInvUsd = 0, sInvAed = 0, sYardUsd = 0, sYardAed = 0;
  let pInvUsd = 0, pInvAed = 0, pYardUsd = 0, pYardAed = 0;

  if (baseCurr === "USD") {
    sInvUsd = sInv; sInvAed = saleConv ? sInv * saleConv : 0;
    sYardUsd = sYard; sYardAed = saleConv ? sYard * saleConv : 0;
    pInvUsd = pInv; pInvAed = purchaseConv ? pInv * purchaseConv : 0;
    pYardUsd = pYard; pYardAed = purchaseConv ? pYard * purchaseConv : 0;
  } else {
    sInvAed = sInv; sInvUsd = saleConv ? sInv / saleConv : 0;
    sYardAed = sYard; sYardUsd = saleConv ? sYard / saleConv : 0;
    pInvAed = pInv; pInvUsd = purchaseConv ? pInv / purchaseConv : 0;
    pYardAed = pYard; pYardUsd = purchaseConv ? pYard / purchaseConv : 0;
  }

  totalUsd = round(quantity * rateUsd);
  totalAed = round(quantity * rateAed);
  pTotalUsd = round(quantity * pRateUsd);
  pTotalAed = round(quantity * pRateAed);

  return {
    type: fd.get("type"),
    deal_no: cleanUpper(fd.get("deal_no")),
    product_name: fd.get("product_name"),
    hsn_code: cleanUpper(fd.get("hsn_code")),
    unit: cleanUpper(fd.get("unit")),
    base_currency: baseCurr,
    document_currency: docCurr,
    sale_conversion_rate: saleConv,
    purchase_conversion_rate: purchaseConv,
    quantity,
    rate, // Sale Rate
    purchase_rate: pRate, // Purchase Rate
    sale_invoice_rate: cleanNumber(fd.get("sale_invoice_rate")),
    sale_yard_rate: cleanNumber(fd.get("sale_yard_rate")),
    purchase_invoice_rate: cleanNumber(fd.get("purchase_invoice_rate")),
    purchase_yard_rate: cleanNumber(fd.get("purchase_yard_rate")),
    sale_invoice_rate_usd: round(sInvUsd),
    sale_invoice_rate_aed: round(sInvAed),
    sale_yard_rate_usd: round(sYardUsd),
    sale_yard_rate_aed: round(sYardAed),
    purchase_invoice_rate_usd: round(pInvUsd),
    purchase_invoice_rate_aed: round(pInvAed),
    purchase_yard_rate_usd: round(pYardUsd),
    purchase_yard_rate_aed: round(pYardAed),
    rate_usd: round(rateUsd),
    rate_aed: round(rateAed),
    purchase_rate_usd: round(pRateUsd),
    purchase_rate_aed: round(pRateAed),
    total_amount: docCurr === "USD" ? totalUsd : totalAed,
    total_amount_usd: totalUsd,
    total_amount_aed: totalAed,
    purchase_total_usd: pTotalUsd,
    purchase_total_aed: pTotalAed,
    status: fd.get("status") || "active",
    approval_status: fd.get("approval_status") || "draft",
    loading_port: cleanUpper(fd.get("loading_port")),
    discharge_port: cleanUpper(fd.get("discharge_port")),
    buyer_id: fd.get("buyer_id") || null,
    supplier_id: fd.get("supplier_id") || null,
    vessel: cleanUpper(fd.get("vessel")),
    vessel_voyage: cleanUpper(fd.get("vessel_voyage")),
    shipment_out_date: fd.get("shipment_out_date") || null,
    eta: fd.get("eta") || null,
    freight_type: cleanUpper(fd.get("freight_type")),
    bl_no: cleanUpper(fd.get("bl_no")),
    pi_no: cleanUpper(fd.get("pi_no")),
    ci_no: cleanUpper(fd.get("ci_no")),
    pl_no: cleanUpper(fd.get("pl_no")),
    coo_no: cleanUpper(fd.get("coo_no")),
    invoice_date: fd.get("invoice_date") || null,
    gross_weight: cleanNumber(fd.get("gross_weight")),
    net_weight: cleanNumber(fd.get("net_weight")),
    package_details: cleanUpper(fd.get("package_details")),
    loaded_on: cleanUpper(fd.get("loaded_on")),
    cfs: cleanUpper(fd.get("cfs")),
    country_of_origin: cleanUpper(fd.get("country_of_origin")),
    terms_delivery: cleanUpper(fd.get("terms_delivery")),
    payment_terms: cleanUpper(fd.get("payment_terms")),
    bank_terms: cleanUpper(fd.get("bank_terms")),
    document_bank_index: fd.get("document_bank_index") || null,
    shipper_index: fd.get("shipper_index") || null,
    shipment_status: fd.get("shipment_status") || "pending",
    container_numbers: String(fd.get("container_numbers") || "").split(/[,\n]+/).map(x => x.trim().toUpperCase()).filter(Boolean),
    commission_name: fd.get("commission_name") || null,
    commission_rate: cleanNumber(fd.get("commission_rate")),
    commission_currency: fd.get("commission_currency") || "USD",
    commission_total: cleanNumber(fd.get("commission_total")),
    is_high_seas: fd.get("is_high_seas") === "true",
    high_seas_buyer_id: fd.get("high_seas_buyer_id") || null
  };
}

export async function saveDeal(e) {
  e.preventDefault();
  try {
    const payload = ensureDocNumbers(validateDeal(new FormData(e.target)));
    const { error } = await supabase.from("deals").insert(payload).select();
    if (error) throw error;
    await loadSupabaseData();
  } catch (err) { 
    if (err.code === "23505") alert("Error: This Deal Number already exists. Please use a unique Deal No.");
    else alert("Error: " + err.message); 
  }
}

export async function updateDeal(e, id) {
  e.preventDefault();
  try {
    const payload = validateDeal(new FormData(e.target));
    const { error } = await supabase.from("deals").update(payload).eq("id", id);
    if (error) throw error;
    await loadSupabaseData();
  } catch (err) { alert(err.message); }
}

export async function deleteDeal(id) {
  if (confirm("Delete this deal?")) {
    const { error } = await supabase.from("deals").delete().eq("id", id);
    if (error) alert(error.message);
    else await loadSupabaseData();
  }
}

export function showDealForm() {
  const wrap = document.getElementById("deal-form-wrap");
  if (!wrap) return;
  wrap.innerHTML = dealFormHtml({}, false);
  document.getElementById("deal-form").addEventListener("submit", saveDeal);
  document.getElementById("cancel-deal-form").addEventListener("click", () => wrap.innerHTML = "");
  bindDealAutoTotal();
  bindProductHsnLookup();
}

export function showEditDealForm(id) {
  const d = state.deals.find(x => String(x.id) === String(id));
  const wrap = document.getElementById(`deal-edit-wrap-${id}`);
  if (!d || !wrap) return;
  wrap.innerHTML = dealFormHtml(d, true, id);
  document.getElementById(`deal-edit-form-${id}`).addEventListener("submit", (e) => updateDeal(e, id));
  document.getElementById(`cancel-deal-edit-${id}`).addEventListener("click", () => wrap.innerHTML = "");
  bindDealAutoTotal(id);
  bindProductHsnLookup(id);
}

export function showHighSeasForm(id) {
  const d = state.deals.find(x => String(x.id) === String(id));
  const wrap = document.getElementById(`high-seas-form-wrap-${id}`);
  if (!d || !wrap) return;
  wrap.innerHTML = highSeasFormHtml(d);
  document.getElementById(`high-seas-form-${id}`).addEventListener("submit", (e) => saveHighSeasDetail(e, id));
  document.getElementById(`cancel-high-seas-${id}`).addEventListener("click", () => wrap.innerHTML = "");
}

export async function saveHighSeasDetail(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const hsBuyerId = fd.get("high_seas_buyer_id");
  
  const { error } = await supabase.from("deals").update({
    is_high_seas: true,
    high_seas_buyer_id: hsBuyerId
  }).eq("id", id);
  
  if (error) alert(error.message);
  else {
    await loadSupabaseData();
    render();
  }
}

export function bindDealAutoTotal(id = null) {
  const suffix = id ? `-${id}` : "";
  const qtyIn = document.getElementById(`quantity${suffix}`);
  const rateIn = document.getElementById(`rate${suffix}`);
  const sInvIn = document.getElementById(`sale-inv-rate${suffix}`);
  const sYardIn = document.getElementById(`sale-yard-rate${suffix}`);
  
  const pRateIn = document.getElementById(`purchase-rate${suffix}`);
  const pInvIn = document.getElementById(`purchase-inv-rate${suffix}`);
  const pYardIn = document.getElementById(`purchase-yard-rate${suffix}`);

  const saleConvIn = document.getElementById(`sale-conv${suffix}`);
  const purchaseConvIn = document.getElementById(`purchase-conv${suffix}`);
  const baseCurrIn = document.getElementById(`base-currency${suffix}`);
  const netIn = document.getElementById(`net-weight${suffix}`);
  const grossIn = document.getElementById(`gross-weight${suffix}`);
  
  const totalUsdIn = document.getElementById(`total${suffix}`);
  const totalAedIn = document.getElementById(`total-aed${suffix}`);
  const pTotalUsdIn = document.getElementById(`purchase-total${suffix}`);
  const pTotalAedIn = document.getElementById(`purchase-total-aed${suffix}`);
  const commRateIn = document.getElementById(`commission-rate${suffix}`);
  const commTotalIn = document.getElementById(`commission-total${suffix}`);

  const updateQtyFromWeight = (e) => {
    const kg = Number(e.target.value || 0);
    if (kg > 0 && qtyIn) {
      qtyIn.value = (kg / 1000).toFixed(2);
      calc(); 
    }
  };

  const handleRateSplit = (totalEl, invEl, yardEl) => {
    const t = Number(totalEl.value || 0);
    const i = Number(invEl.value || 0);
    const y = t - i;
    yardEl.value = y > 0 ? y.toFixed(2) : "0.00";
    calc();
  };

  const handleYardChange = (totalEl, invEl, yardEl) => {
    const i = Number(invEl.value || 0);
    const y = Number(yardEl.value || 0);
    totalEl.value = (i + y).toFixed(2);
    calc();
  };

  rateIn?.addEventListener("input", () => handleRateSplit(rateIn, sInvIn, sYardIn));
  sInvIn?.addEventListener("input", () => handleRateSplit(rateIn, sInvIn, sYardIn));
  sYardIn?.addEventListener("input", () => handleYardChange(rateIn, sInvIn, sYardIn));

  pRateIn?.addEventListener("input", () => handleRateSplit(pRateIn, pInvIn, pYardIn));
  pInvIn?.addEventListener("input", () => handleRateSplit(pRateIn, pInvIn, pYardIn));
  pYardIn?.addEventListener("input", () => handleYardChange(pRateIn, pInvIn, pYardIn));

  netIn?.addEventListener("input", updateQtyFromWeight);
  grossIn?.addEventListener("input", updateQtyFromWeight);

  const calc = () => {
    const q = Number(qtyIn?.value || 0);
    const r = Number(rateIn?.value || 0);
    const pr = Number(pRateIn?.value || 0);
    const sc = Number(saleConvIn?.value || 0);
    const pc = Number(purchaseConvIn?.value || 0);
    const bc = baseCurrIn?.value || "USD";
    const cr = Number(commRateIn?.value || 0);

    const round = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    // Sale Totals
    let sUsd = 0, sAed = 0;
    if (bc === "USD") {
      sUsd = q * r;
      sAed = sc ? sUsd * sc : 0;
    } else {
      sAed = q * r;
      sUsd = sc ? sAed / sc : 0;
    }
    sUsd = round(sUsd);
    sAed = round(sAed);

    // Purchase Totals
    let pUsd = 0, pAed = 0;
    if (bc === "USD") {
      pUsd = q * pr;
      pAed = pc ? pUsd * pc : 0;
    } else {
      pAed = q * pr;
      pUsd = pc ? pAed / pc : 0;
    }
    pUsd = round(pUsd);
    pAed = round(pAed);

    // Commission Total
    const commTotal = round(q * cr);

    if (totalUsdIn) totalUsdIn.value = sUsd.toFixed(2);
    if (totalAedIn) totalAedIn.value = sAed.toFixed(2);
    if (pTotalUsdIn) pTotalUsdIn.value = pUsd.toFixed(2);
    if (pTotalAedIn) pTotalAedIn.value = pAed.toFixed(2);
    if (commTotalIn) commTotalIn.value = commTotal.toFixed(2);
  };

  [qtyIn, saleConvIn, purchaseConvIn, baseCurrIn, commRateIn].forEach(el => el?.addEventListener("input", calc));
  [qtyIn, saleConvIn, purchaseConvIn, baseCurrIn, commRateIn].forEach(el => el?.addEventListener("change", calc));
}

export function bindProductHsnLookup(id = null) {
  const suffix = id ? `-${id}` : "";
  const nameSelect = document.getElementById(`product-name${suffix}`);
  const hsnInput = document.getElementById(`hsn-code${suffix}`);
  if (!nameSelect || !hsnInput) return;

  nameSelect.addEventListener("change", (e) => {
    const opt = e.target.selectedOptions[0];
    if (opt && opt.dataset.hsn) {
      hsnInput.value = opt.dataset.hsn;
    }
  });
}

export async function exportDealsCsv() {
  const data = state.deals;
  if (!data.length) return alert("No deals to export.");
  
  const headers = ["Deal No", "Status", "Buyer", "Supplier", "Product", "Qty", "Unit", "Total Sale USD", "Total Purchase USD", "BL No"];
  const rows = data.map(d => [
    d.deal_no,
    d.status,
    buyerName(d.buyer_id),
    supplierName(d.supplier_id),
    d.product_name,
    d.quantity,
    d.unit,
    d.total_amount_usd,
    d.purchase_total_usd,
    d.bl_no
  ]);

  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `deals_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
}
