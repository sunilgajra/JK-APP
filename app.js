import { openPrintWindow, buildPI, buildCI, buildPL, buildCOO } from "./documents.js";
import { supabase } from "./supabase.js";

const state = {
  page: "dashboard",
  buyers: [],
  suppliers: [],
  deals: [],
  dealSearch: "",
  buyerSearch: "",
  supplierSearch: "",
  paymentsByDeal: {},
  documentsByDeal: {},
  selectedDealId: null,
  company: {
    id: 1,
    name: "JK PETROCHEM INTERNATIONAL FZE",
    address: "OFFICE NO:E2-110G-02, HAMARIYA FREE ZONE, SHARJAH, UAE",
    bankAccounts: [],
    mobile: "+971524396170",
    email: "info@jkpetrochem.com"
  },
  error: "",
  ready: false
};

const content = document.getElementById("content");

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanText(v) {
  return String(v || "").trim();
}

function cleanNumber(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeCustomerId(v) {
  return String(v || "").replace(/\D/g, "");
}

function nextCustomerId() {
  const nums = state.buyers
    .map((b) => Number(String(b.customer_id || "").replace(/\D/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);

  return String((nums.length ? Math.max(...nums) : 1000) + 1);
}

function setPage(page) {
  state.page = page;
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });
  render();
}

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => setPage(btn.dataset.page));
});

function buyerName(id) {
  return state.buyers.find((b) => String(b.id) === String(id))?.name || "—";
}

function supplierName(id) {
  return state.suppliers.find((s) => String(s.id) === String(id))?.name || "—";
}

function paymentsForDeal(dealId) {
  return state.paymentsByDeal[String(dealId)] || [];
}

function documentsForDeal(dealId) {
  return state.documentsByDeal[String(dealId)] || [];
}

function paymentSummary(dealId, totalAmount, dealType = "sell") {
  const list = paymentsForDeal(dealId);
  let received = 0;
  let sent = 0;

  list.forEach((p) => {
    if (p.direction === "out") sent += Number(p.amount || 0);
    else received += Number(p.amount || 0);
  });

  const total = Number(totalAmount || 0);
  const balance = dealType === "purchase" ? total - sent : total - received;

  return { received, sent, balance };
}

function getSelectedDeal() {
  return state.deals.find((d) => String(d.id) === String(state.selectedDealId)) || null;
}

function bindDealAutoTotal(edit = false, id = "") {
  const qtyEl = document.getElementById(edit ? `quantity-${id}` : "quantity");
  const rateEl = document.getElementById(edit ? `rate-${id}` : "rate");
  const totalEl = document.getElementById(edit ? `total-${id}` : "total");
  const totalAedEl = document.getElementById(edit ? `total-aed-${id}` : "total-aed");
  const convEl = document.getElementById(edit ? `conversion-rate-${id}` : "conversion-rate");
  const baseCurrencyEl = document.getElementById(edit ? `base-currency-${id}` : "base-currency");

  if (!qtyEl || !rateEl || !totalEl || !totalAedEl) return;

  function calcTotal() {
    const qty = Number(qtyEl.value || 0);
    const rate = Number(rateEl.value || 0);
    const conv = Number(convEl?.value || 0);
    const baseCurrency = baseCurrencyEl?.value || "USD";
    const total = qty * rate;

    totalEl.value = total ? total.toFixed(2) : "";

    if (baseCurrency === "USD") {
      const totalAed = total * conv;
      totalAedEl.value = totalAed ? totalAed.toFixed(2) : "";
    } else {
      totalAedEl.value = total ? total.toFixed(2) : "";
    }
  }

  qtyEl.addEventListener("input", calcTotal);
  rateEl.addEventListener("input", calcTotal);
  convEl?.addEventListener("input", calcTotal);
  baseCurrencyEl?.addEventListener("change", calcTotal);
  calcTotal();
}

function monthSuffix(dateStr = "") {
  const d = dateStr ? new Date(dateStr) : new Date();
  const m = d.getMonth() + 1;
  return String(m).padStart(2, "0");
}

function nextDocNumber(prefix, fieldName, invoiceDate = "") {
  const mm = monthSuffix(invoiceDate);
  const nums = state.deals
    .map((d) => String(d[fieldName] || "").match(new RegExp(`^${prefix}\\s(\\d+)\\/(\\d{2})$`)))
    .filter(Boolean)
    .map((m) => Number(m[1] || 0));

  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix} ${String(next).padStart(5, "0")}/${mm}`;
}

function ensureDocNumbers(payload, existing = null) {
  const invoiceDate = payload.invoice_date || existing?.invoice_date || "";
  payload.pi_no = cleanText(payload.pi_no) || existing?.pi_no || nextDocNumber("PI", "pi_no", invoiceDate);
  payload.ci_no = cleanText(payload.ci_no) || existing?.ci_no || nextDocNumber("CI", "ci_no", invoiceDate);
  payload.pl_no = cleanText(payload.pl_no) || existing?.pl_no || nextDocNumber("PL", "pl_no", invoiceDate);
  payload.coo_no = cleanText(payload.coo_no) || existing?.coo_no || nextDocNumber("COO", "coo_no", invoiceDate);
  return payload;
}

function dashboardView() {
  const totalDeals = state.deals.length;
  const totalBuyers = state.buyers.length;
  const totalSuppliers = state.suppliers.length;
  const totalValue = state.deals.reduce((sum, d) => sum + Number(d.total_amount_aed || d.total_amount || 0), 0);
  const totalReceived = state.deals.reduce((sum, d) => {
    const s = paymentSummary(d.id, d.total_amount_aed || d.total_amount, d.type);
    return sum + s.received;
  }, 0);
  const activeDeals = state.deals.filter((d) => (d.status || "").toLowerCase() !== "completed").length;
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
        <div class="stat-value" style="font-size:20px">AED ${totalValue.toLocaleString("en-IN")}</div>
        <div class="item-sub">Across all deals</div>
      </div>

      <div class="card">
        <div class="stat-label">Received Payments</div>
        <div class="stat-value" style="font-size:20px;color:#22c55e">AED ${totalReceived.toLocaleString("en-IN")}</div>
        <div class="item-sub">Payments received</div>
      </div>

      <div class="card">
        <div class="stat-label">Network</div>
        <div class="stat-value" style="font-size:20px">${totalBuyers + totalSuppliers}</div>
        <div class="item-sub">${totalBuyers} buyers · ${totalSuppliers} suppliers</div>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div class="title" style="margin-bottom:0">Recent Deals</div>
        <button id="open-company-settings">Company Settings</button>
      </div>

      <div class="list" style="margin-top:14px">
        ${
          recentDeals.length
            ? recentDeals.map((d) => {
                const s = paymentSummary(d.id, d.total_amount_aed || d.total_amount, d.type);
                return `
              <div class="item" style="padding:14px">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
                  <div style="min-width:0;flex:1">
                    <div class="item-title">${esc(d.deal_no || "—")} · ${esc(d.product_name || "—")}</div>
                    <div class="item-sub">HSN: ${esc(d.hsn_code || "—")}</div>
                    <div class="item-sub">${esc(d.loading_port || "—")} → ${esc(d.discharge_port || "—")}</div>
                    <div class="item-sub">${esc(d.type || "sell")} · ${esc(d.status || "active")}</div>
                  </div>
                  <div style="text-align:right;min-width:150px">
                    <div style="font-size:15px;font-weight:800;color:#d4a646">
                      ${esc(d.document_currency || "AED")} ${Number((d.document_currency === "AED" ? d.total_amount_aed : d.total_amount) || 0).toLocaleString("en-IN")}
                    </div>
                    <div class="item-sub">Received: ${esc(d.document_currency || "AED")} ${s.received.toLocaleString("en-IN")}</div>
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

function buyersView() {
  const q = state.buyerSearch.trim().toLowerCase();
  const filteredBuyers = state.buyers.filter((b) => {
    if (!q) return true;
    const text = [b.name, b.address, b.gst, b.iec, b.customer_id, b.phone].join(" ").toLowerCase();
    return text.includes(q);
  });

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">
        <div class="title" style="margin-bottom:0">Buyers</div>
        <button id="show-buyer-form" style="background:#d4a646;color:#fff;border:none">Add Buyer</button>
      </div>

      <div style="margin-bottom:12px">
        <input id="buyer-search" value="${esc(state.buyerSearch || "")}" placeholder="Search buyers by name, address, GST, IEC..." />
      </div>

      <div id="buyer-form-wrap"></div>

      <div class="list" style="margin-top:12px">
        ${
          filteredBuyers.length
            ? filteredBuyers.map((b) => `
          <div class="item">
            <div class="item-title">${esc(b.name || "—")}</div>
            <div class="item-sub">${esc(b.address || "—")}</div>
            <div class="item-sub">GST: ${esc(b.gst || "—")} · IEC: ${esc(b.iec || "—")}</div>
            <div class="item-sub">Customer ID: ${esc(b.customer_id || "—")}</div>
            <div class="item-sub">Phone: ${esc(b.phone || "—")}</div>
            <div style="margin-top:8px;display:flex;gap:8px">
              <button data-edit-buyer="${b.id}">Edit</button>
              <button data-delete-buyer="${b.id}">Delete</button>
            </div>
            <div id="buyer-edit-wrap-${b.id}" style="margin-top:10px"></div>
          </div>
        `).join("")
            : `<div class="empty">No matching buyers found.</div>`
        }
      </div>
    </div>
  `;
}

function suppliersView() {
  const q = state.supplierSearch.trim().toLowerCase();
  const filteredSuppliers = state.suppliers.filter((s) => {
    if (!q) return true;
    const text = [
      s.name,
      s.company_name,
      s.country,
      s.email,
      s.address,
      s.bank_name,
      s.bank_account,
      s.bank_iban,
      s.bank_swift
    ].join(" ").toLowerCase();
    return text.includes(q);
  });

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">
        <div class="title" style="margin-bottom:0">Suppliers</div>
        <button id="show-supplier-form" style="background:#d4a646;color:#fff;border:none">Add Supplier</button>
      </div>

      <div style="margin-bottom:12px">
        <input id="supplier-search" value="${esc(state.supplierSearch || "")}" placeholder="Search suppliers by name, company, email, country..." />
      </div>

      <div id="supplier-form-wrap"></div>

      <div class="list" style="margin-top:12px">
        ${
          filteredSuppliers.length
            ? filteredSuppliers.map((s) => `
          <div class="item">
            <div class="item-title">${esc(s.name || "—")}</div>
            <div class="item-sub">Company: ${esc(s.company_name || "—")}</div>
            <div class="item-sub">Country: ${esc(s.country || "—")}</div>
            <div class="item-sub">Email: ${esc(s.email || "—")}</div>
            <div class="item-sub">Address: ${esc(s.address || "—")}</div>
            <div class="item-sub">Bank: ${esc(s.bank_name || "—")} · A/C: ${esc(s.bank_account || "—")}</div>
            <div class="item-sub">IBAN: ${esc(s.bank_iban || "—")} · SWIFT: ${esc(s.bank_swift || "—")}</div>

            <div style="margin-top:8px;display:flex;gap:8px">
              <button data-edit-supplier="${s.id}">Edit</button>
              <button data-delete-supplier="${s.id}">Delete</button>
            </div>
            <div id="supplier-edit-wrap-${s.id}" style="margin-top:10px"></div>
          </div>
        `).join("")
            : `<div class="empty">No matching suppliers found.</div>`
        }
      </div>
    </div>
  `;
}

function dealsView() {
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
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">
        <div class="title" style="margin-bottom:0">Deals</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="export-deals-csv">Export CSV</button>
          <button id="show-deal-form" style="background:#d4a646;color:#fff;border:none">Add Deal</button>
        </div>
      </div>

      <div style="margin-bottom:12px">
        <input id="deal-search" value="${esc(state.dealSearch || "")}" placeholder="Search by deal no, product, buyer, supplier, route..." />
      </div>

      <div id="deal-form-wrap"></div>

      <div class="list" style="margin-top:12px">
        ${
          filteredDeals.length
            ? filteredDeals.map((d) => {
                const s = paymentSummary(d.id, d.total_amount_aed || d.total_amount, d.type);
                const payments = paymentsForDeal(d.id);
                return `
            <div class="item">
              <div class="item-title">${esc(d.deal_no || "—")} · ${esc(d.product_name || "—")}</div>
              <div class="item-sub">HSN: ${esc(d.hsn_code || "—")}</div>
              <div class="item-sub">${esc(d.loading_port || "—")} → ${esc(d.discharge_port || "—")}</div>
              <div class="item-sub">Base: ${esc(d.base_currency || "USD")} · Doc: ${esc(d.document_currency || "AED")} · Rate: ${esc(d.conversion_rate || "—")}</div>
              <div class="item-sub">${esc(d.document_currency || "AED")} ${Number((d.document_currency === "AED" ? d.total_amount_aed : d.total_amount) || 0).toLocaleString("en-IN")} · ${esc(d.status || "active")}</div>
              <div class="item-sub">${esc(d.type || "sell")} · Buyer: ${esc(buyerName(d.buyer_id))} · Supplier: ${esc(supplierName(d.supplier_id))}</div>
              <div class="item-sub">Received: ${esc(d.document_currency || "AED")} ${s.received.toLocaleString("en-IN")} · Sent: ${esc(d.document_currency || "AED")} ${s.sent.toLocaleString("en-IN")} · Balance: ${esc(d.document_currency || "AED")} ${s.balance.toLocaleString("en-IN")}</div>

              <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
                <button data-open-deal="${d.id}">Open</button>
                <button data-show-payment-form="${d.id}">Add Payment</button>
                <button data-edit-deal="${d.id}">Edit</button>
                <button data-delete-deal="${d.id}">Delete</button>
              </div>

              <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
                <button data-print-pi="${d.id}">Print PI</button>
                <button data-print-ci="${d.id}">Print CI</button>
                <button data-print-pl="${d.id}">Print PL</button>
                <button data-print-coo="${d.id}">Print COO</button>
              </div>

              <div id="deal-edit-wrap-${d.id}" style="margin-top:10px"></div>
              <div id="payment-form-wrap-${d.id}" style="margin-top:10px"></div>

              <div class="list" style="margin-top:10px">
                ${
                  payments.length
                    ? payments.map((p) => `
                  <div class="item" style="padding:10px">
                    <div class="item-title">${esc(p.currency || d.document_currency || "AED")} ${Number(p.amount || 0).toLocaleString("en-IN")}</div>
                    <div class="item-sub">${esc(p.direction || "in")} · ${esc(p.method || "—")} · ${esc(p.status || "pending")}</div>
                    <div class="item-sub">${esc(p.ref || "—")} · ${esc(p.payment_date || "—")}</div>
                    <div style="margin-top:8px;display:flex;gap:8px">
                      <button data-delete-payment="${d.id}:${p.id}">Delete Payment</button>
                    </div>
                  </div>
                `).join("")
                    : `<div class="item-sub">No payments yet.</div>`
                }
              </div>
            </div>
          `;
              }).join("")
            : `<div class="empty">No matching deals found.</div>`
        }
      </div>
    </div>
  `;
}

function dealDetailView() {
  const d = getSelectedDeal();
  if (!d) return `<div class="card"><div class="title">Deal not found</div></div>`;

  const buyer = state.buyers.find((b) => String(b.id) === String(d.buyer_id));
  const supplier = state.suppliers.find((s) => String(s.id) === String(d.supplier_id));
  const payments = paymentsForDeal(d.id);
  const documents = documentsForDeal(d.id);
  const s = paymentSummary(d.id, d.total_amount_aed || d.total_amount, d.type);

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px">
        <div class="title" style="margin-bottom:0">${esc(d.deal_no || "Deal Detail")}</div>
        <button id="back-to-deals">Back</button>
      </div>

      <div class="grid grid-2">
        <div class="item"><div class="item-title">Product</div><div class="item-sub">${esc(d.product_name || "—")}</div></div>
        <div class="item"><div class="item-title">HSN Code</div><div class="item-sub">${esc(d.hsn_code || "—")}</div></div>
        <div class="item"><div class="item-title">Status</div><div class="item-sub">${esc(d.status || "active")}</div></div>
        <div class="item"><div class="item-title">Route</div><div class="item-sub">${esc(d.loading_port || "—")} → ${esc(d.discharge_port || "—")}</div></div>
        <div class="item"><div class="item-title">Base Currency</div><div class="item-sub">${esc(d.base_currency || "USD")}</div></div>
        <div class="item"><div class="item-title">Conversion Rate</div><div class="item-sub">${esc(d.conversion_rate || "—")}</div></div>
        <div class="item"><div class="item-title">Total (${esc(d.base_currency || "USD")})</div><div class="item-sub">${esc(d.base_currency || "USD")} ${Number(d.total_amount || 0).toLocaleString("en-IN")}</div></div>
        <div class="item"><div class="item-title">Total (AED)</div><div class="item-sub">AED ${Number(d.total_amount_aed || 0).toLocaleString("en-IN")}</div></div>
        <div class="item"><div class="item-title">Document Currency</div><div class="item-sub">${esc(d.document_currency || "AED")}</div></div>
        <div class="item"><div class="item-title">Shipment Out Date</div><div class="item-sub">${esc(d.shipment_out_date || "—")}</div></div>
        <div class="item"><div class="item-title">ETA</div><div class="item-sub">${esc(d.eta || "—")}</div></div>
        <div class="item"><div class="item-title">BL No</div><div class="item-sub">${esc(d.bl_no || "—")}</div></div>
        <div class="item"><div class="item-title">Vessel / Voyage</div><div class="item-sub">${esc(d.vessel_voyage || d.vessel || "—")}</div></div>
        <div class="item"><div class="item-title">Origin</div><div class="item-sub">${esc(d.country_of_origin || "—")}</div></div>
        <div class="item"><div class="item-title">PI No</div><div class="item-sub">${esc(d.pi_no || "—")}</div></div>
        <div class="item"><div class="item-title">CI No</div><div class="item-sub">${esc(d.ci_no || "—")}</div></div>
        <div class="item"><div class="item-title">PL No</div><div class="item-sub">${esc(d.pl_no || "—")}</div></div>
        <div class="item"><div class="item-title">COO No</div><div class="item-sub">${esc(d.coo_no || "—")}</div></div>
        <div class="item"><div class="item-title">Buyer</div><div class="item-sub">${esc(buyer?.name || "—")}</div></div>
        <div class="item">
          <div class="item-title">Supplier</div>
          <div class="item-sub">${esc(supplier?.name || "—")}</div>
          <div class="item-sub">${esc(supplier?.company_name || "—")}</div>
          <div class="item-sub">${esc(supplier?.email || "—")}</div>
          <div class="item-sub">${esc(supplier?.address || "—")}</div>
          <div class="item-sub">Bank: ${esc(supplier?.bank_name || "—")}</div>
          <div class="item-sub">A/C: ${esc(supplier?.bank_account || "—")}</div>
          <div class="item-sub">IBAN: ${esc(supplier?.bank_iban || "—")} · SWIFT: ${esc(supplier?.bank_swift || "—")}</div>
        </div>
      </div>

      <div class="item" style="margin-top:12px">
        <div class="item-title">Payment Summary</div>
        <div class="item-sub">Received: ${esc(d.document_currency || "AED")} ${s.received.toLocaleString("en-IN")}</div>
        <div class="item-sub">Sent: ${esc(d.document_currency || "AED")} ${s.sent.toLocaleString("en-IN")}</div>
        <div class="item-sub">Balance: ${esc(d.document_currency || "AED")} ${s.balance.toLocaleString("en-IN")}</div>
      </div>

      <div class="item" style="margin-top:12px">
        <div class="item-title">Documents</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <button data-print-pi="${d.id}">Print PI</button>
          <button data-print-ci="${d.id}">Print CI</button>
          <button data-print-pl="${d.id}">Print PL</button>
          <button data-print-coo="${d.id}">Print COO</button>
        </div>
      </div>

      <div class="item" style="margin-top:12px">
        <div class="item-title">Deal Documents</div>

        <form data-placeholder-upload="${d.id}" style="margin-top:10px;display:grid;gap:10px">
          <select name="docType">
            <option value="BL">BL</option>
            <option value="OBL">OBL</option>
            <option value="Telex">Telex</option>
            <option value="Supplier Invoice">Supplier Invoice</option>
            <option value="Commercial Invoice">Commercial Invoice</option>
            <option value="Packing List">Packing List</option>
            <option value="Certificate">Certificate</option>
            <option value="Other">Other</option>
          </select>

          <input type="file" name="file">

          <div style="display:flex;gap:10px">
            <button type="submit" style="background:#d4a646;color:#fff;border:none">Add Placeholder</button>
          </div>
        </form>

        <div class="list" style="margin-top:12px">
          ${
            documents.length
              ? documents.map((doc, idx) => `
            <div class="item" style="padding:10px">
              <div class="item-title">${esc(doc.type || "Document")}</div>
              <div class="item-sub">${esc(doc.file_name || doc.fileName || "No file selected")}</div>
              <div class="item-sub">Status: Placeholder only</div>
              <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" disabled>View</button>
                <button type="button" disabled>Download</button>
                <button data-delete-placeholder-doc="${d.id}:${idx}" type="button">Delete</button>
              </div>
            </div>
          `).join("")
              : `<div class="item-sub">No documents added yet.</div>`
          }
        </div>
      </div>

      <div class="item" style="margin-top:12px">
        <div class="item-title">Payments</div>
        <div style="margin-top:8px">
          <button data-show-payment-form="${d.id}">Add Payment</button>
        </div>
        <div id="payment-form-wrap-${d.id}" style="margin-top:10px"></div>
        <div class="list" style="margin-top:10px">
          ${
            payments.length
              ? payments.map((p) => `
            <div class="item" style="padding:10px">
              <div class="item-title">${esc(p.currency || d.document_currency || "AED")} ${Number(p.amount || 0).toLocaleString("en-IN")}</div>
              <div class="item-sub">${esc(p.direction || "in")} · ${esc(p.method || "—")} · ${esc(p.status || "pending")}</div>
              <div class="item-sub">${esc(p.ref || "—")} · ${esc(p.payment_date || "—")}</div>
              <div style="margin-top:8px;display:flex;gap:8px">
                <button data-delete-payment="${d.id}:${p.id}">Delete Payment</button>
              </div>
            </div>
          `).join("")
              : `<div class="item-sub">No payments yet.</div>`
          }
        </div>
      </div>
    </div>
  `;
}

function settingsView() {
  const c = state.company;

  return `
    <div class="card">
      <div class="title">Company Settings</div>

      <form id="company-settings-form" class="item" style="margin-top:12px">
        <div style="display:grid;gap:10px">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Company Name</label>
            <input name="name" value="${esc(c.name || "")}" placeholder="Company name">
          </div>

          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Address</label>
            <textarea name="address" placeholder="Address" style="min-height:90px">${esc(c.address || "")}</textarea>
          </div>

          <div>
            <div style="font-weight:800;margin-bottom:10px;color:#d4a646">Bank Accounts</div>
            <div id="bank-list">
              ${(c.bankAccounts || []).map((b, i) => `
                <div class="item" style="margin-bottom:10px">
                  <div><b>${esc(b.bankName)}</b></div>
                  <div>A/C: ${esc(b.account)}</div>
                  <div>IBAN: ${esc(b.iban || "-")}</div>
                  <div>SWIFT: ${esc(b.swift || "-")}</div>
                  <button type="button" data-delete-bank="${i}" style="margin-top:6px">Delete</button>
                </div>
              `).join("")}
            </div>

            <button type="button" id="add-bank-btn" style="margin-top:10px">+ Add Bank</button>
          </div>

          <button type="submit" style="background:#d4a646;color:#fff;border:none">Save Settings</button>
        </div>
      </form>
    </div>
  `;
}

function render() {
  if (state.page === "dashboard") content.innerHTML = dashboardView();
  if (state.page === "buyers") content.innerHTML = buyersView();
  if (state.page === "suppliers") content.innerHTML = suppliersView();
  if (state.page === "deals") content.innerHTML = dealsView();
  if (state.page === "dealDetail") content.innerHTML = dealDetailView();
  if (state.page === "settings") content.innerHTML = settingsView();
  bindUI();
}

function bindUI() {
  document.getElementById("show-buyer-form")?.addEventListener("click", showBuyerForm);
  document.getElementById("show-supplier-form")?.addEventListener("click", showSupplierForm);
  document.getElementById("show-deal-form")?.addEventListener("click", showDealForm);
  document.getElementById("back-to-deals")?.addEventListener("click", () => setPage("deals"));
  document.getElementById("open-company-settings")?.addEventListener("click", () => setPage("settings"));
  document.getElementById("company-settings-form")?.addEventListener("submit", saveCompanySettings);
  document.getElementById("add-bank-btn")?.addEventListener("click", addBankAccount);
  document.getElementById("export-deals-csv")?.addEventListener("click", exportDealsCsv);

  document.querySelectorAll("[data-delete-bank]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.deleteBank);
      state.company.bankAccounts.splice(index, 1);
      render();
    });
  });

  document.getElementById("deal-search")?.addEventListener("input", (e) => {
    state.dealSearch = e.target.value;
    render();
  });

  document.getElementById("buyer-search")?.addEventListener("input", (e) => {
    state.buyerSearch = e.target.value;
    render();
  });

  document.getElementById("supplier-search")?.addEventListener("input", (e) => {
    state.supplierSearch = e.target.value;
    render();
  });

  document.querySelectorAll("[data-open-deal]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.selectedDealId = btn.dataset.openDeal;
      setPage("dealDetail");
    })
  );

  document.querySelectorAll("[data-show-payment-form]").forEach((btn) =>
    btn.addEventListener("click", () => showPaymentForm(btn.dataset.showPaymentForm))
  );

  document.querySelectorAll("[data-delete-payment]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const [dealId, paymentId] = btn.dataset.deletePayment.split(":");
      deletePayment(dealId, paymentId);
    })
  );

  document.querySelectorAll("[data-placeholder-upload]").forEach((form) => {
    form.addEventListener("submit", (e) => savePlaceholderDocument(e, form.dataset.placeholderUpload));
  });

  document.querySelectorAll("[data-delete-placeholder-doc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [dealId, index] = btn.dataset.deletePlaceholderDoc.split(":");
      deletePlaceholderDocument(dealId, Number(index));
    });
  });

  document.querySelectorAll("[data-edit-buyer]").forEach((btn) =>
    btn.addEventListener("click", () => showEditBuyerForm(btn.dataset.editBuyer))
  );

  document.querySelectorAll("[data-delete-buyer]").forEach((btn) =>
    btn.addEventListener("click", () => deleteBuyer(btn.dataset.deleteBuyer))
  );

  document.querySelectorAll("[data-edit-supplier]").forEach((btn) =>
    btn.addEventListener("click", () => showEditSupplierForm(btn.dataset.editSupplier))
  );

  document.querySelectorAll("[data-delete-supplier]").forEach((btn) =>
    btn.addEventListener("click", () => deleteSupplier(btn.dataset.deleteSupplier))
  );

  document.querySelectorAll("[data-edit-deal]").forEach((btn) =>
    btn.addEventListener("click", () => showEditDealForm(btn.dataset.editDeal))
  );

  document.querySelectorAll("[data-delete-deal]").forEach((btn) =>
    btn.addEventListener("click", () => deleteDeal(btn.dataset.deleteDeal))
  );

  document.querySelectorAll("[data-print-pi]").forEach((btn) =>
    btn.addEventListener("click", () => printDoc("pi", btn.dataset.printPi))
  );

  document.querySelectorAll("[data-print-ci]").forEach((btn) =>
    btn.addEventListener("click", () => printDoc("ci", btn.dataset.printCi))
  );

  document.querySelectorAll("[data-print-pl]").forEach((btn) =>
    btn.addEventListener("click", () => printDoc("pl", btn.dataset.printPl))
  );

  document.querySelectorAll("[data-print-coo]").forEach((btn) =>
    btn.addEventListener("click", () => printDoc("coo", btn.dataset.printCoo))
  );
}

render();
loadSupabaseData();