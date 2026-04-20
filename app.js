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
  auditLogsByEntity: {},
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

function formatAuditValue(v) {
  if (v == null) return "—";
  if (typeof v === "object") {
    const values = Object.values(v);
    if (values.length === 1) return String(values[0] ?? "—");
    return JSON.stringify(v);
  }
  return String(v);
}

function dealAuditLogs(dealId) {
  return state.auditLogsByEntity[`deals:${dealId}`] || [];
}

function formatAuditTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("en-IN");
}

function bindDealAutoTotal(edit = false, id = "") {
  const qtyEl = document.getElementById(edit ? `quantity-${id}` : "quantity");
  const rateEl = document.getElementById(edit ? `rate-${id}` : "rate");
  const totalEl = document.getElementById(edit ? `total-${id}` : "total");
  const totalAedEl = document.getElementById(edit ? `total-aed-${id}` : "total-aed");
  const convEl = document.getElementById(edit ? `conversion-rate-${id}` : "conversion-rate");
  const baseCurrencyEl = document.getElementById(edit ? `base-currency-${id}` : "base-currency");
  const docCurrencyEl = document.querySelector(
    edit ? `#deal-edit-form-${id} select[name="document_currency"]` : `#deal-form select[name="document_currency"]`
  );
  const totalLabelEl = document.getElementById(edit ? `total-label-${id}` : "total-label");

  if (!qtyEl || !rateEl || !totalEl || !totalAedEl || !baseCurrencyEl || !docCurrencyEl) return;

  function calcTotal() {
    const qty = Number(qtyEl.value || 0);
    const rate = Number(rateEl.value || 0);
    const conv = Number(convEl?.value || 0);
    const baseCurrency = baseCurrencyEl.value || "USD";
    const documentCurrency = docCurrencyEl.value || baseCurrency;

    let totalUsd = 0;
    let totalAed = 0;

    if (baseCurrency === "USD") {
      totalUsd = qty * rate;
      totalAed = conv > 0 ? totalUsd * conv : 0;
    } else {
      totalAed = qty * rate;
      totalUsd = conv > 0 ? totalAed / conv : 0;
    }

    if (documentCurrency === "USD") {
      totalEl.value = totalUsd ? totalUsd.toFixed(2) : "";
    } else {
      totalEl.value = totalAed ? totalAed.toFixed(2) : "";
    }

    totalAedEl.value = totalAed ? totalAed.toFixed(2) : "";

    if (totalLabelEl) {
      totalLabelEl.textContent = `Total (${documentCurrency})`;
    }
  }

  qtyEl.addEventListener("input", calcTotal);
  rateEl.addEventListener("input", calcTotal);
  convEl?.addEventListener("input", calcTotal);
  baseCurrencyEl.addEventListener("change", calcTotal);
  docCurrencyEl.addEventListener("change", calcTotal);

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

    <div class="card" style="margin-top:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div class="title" style="margin-bottom:0">Recent Deals</div>
        <button id="open-company-settings">Company Settings</button>
      </div>

      <div class="list" style="margin-top:14px">
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
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
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
                const s = paymentSummary(d.id, d.total_amount, d.type);
                const payments = paymentsForDeal(d.id);
                return `
            <div class="item">
              <div class="item-title">${esc(d.deal_no || "—")} · ${esc(d.product_name || "—")}</div>
              <div class="item-sub">HSN: ${esc(d.hsn_code || "—")}</div>
              <div class="item-sub">${esc(d.loading_port || "—")} → ${esc(d.discharge_port || "—")}</div>
              <div class="item-sub">${esc(d.currency || "AED")} ${Number(d.total_amount || 0).toLocaleString("en-IN")} · ${esc(d.status || "active")}</div>
              <div class="item-sub">${esc(d.type || "sell")} · Buyer: ${esc(buyerName(d.buyer_id))} · Supplier: ${esc(supplierName(d.supplier_id))}</div>
              <div class="item-sub">Received: ${esc(d.currency || "AED")} ${s.received.toLocaleString("en-IN")} · Sent: ${esc(d.currency || "AED")} ${s.sent.toLocaleString("en-IN")} · Balance: ${esc(d.currency || "AED")} ${s.balance.toLocaleString("en-IN")}</div>

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
                    <div class="item-title">${esc(p.currency || d.currency || "AED")} ${Number(p.amount || 0).toLocaleString("en-IN")}</div>
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
  const s = paymentSummary(d.id, d.total_amount, d.type);
  const showCurrency = d.document_currency || d.currency || d.base_currency || "AED";
  const showTotal = showCurrency === "USD"
    ? Number(d.total_amount_usd || d.total_amount || 0)
    : Number(d.total_amount_aed || d.total_amount || 0);

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
        <div class="item"><div class="item-title">Approval Status</div><div class="item-sub">${esc(d.approval_status || "draft")}</div></div>
        <div class="item"><div class="item-title">Route</div><div class="item-sub">${esc(d.loading_port || "—")} → ${esc(d.discharge_port || "—")}</div></div>
        <div class="item"><div class="item-title">Value</div><div class="item-sub">${esc(showCurrency)} ${showTotal.toLocaleString("en-IN")}</div></div>
        <div class="item"><div class="item-title">Base Currency</div><div class="item-sub">${esc(d.base_currency || "USD")}</div></div>
        <div class="item"><div class="item-title">Document Currency</div><div class="item-sub">${esc(d.document_currency || d.currency || "AED")}</div></div>
        <div class="item"><div class="item-title">Conversion Rate</div><div class="item-sub">${esc(d.conversion_rate || "—")}</div></div>
        <div class="item"><div class="item-title">Total USD</div><div class="item-sub">USD ${Number(d.total_amount_usd || 0).toLocaleString("en-IN")}</div></div>
        <div class="item"><div class="item-title">Total AED</div><div class="item-sub">AED ${Number(d.total_amount_aed || 0).toLocaleString("en-IN")}</div></div>
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
        <div class="item-sub">Received: ${esc(showCurrency)} ${s.received.toLocaleString("en-IN")}</div>
        <div class="item-sub">Sent: ${esc(showCurrency)} ${s.sent.toLocaleString("en-IN")}</div>
        <div class="item-sub">Balance: ${esc(showCurrency)} ${s.balance.toLocaleString("en-IN")}</div>
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
            <button type="submit" style="background:#d4a646;color:#fff;border:none">Upload Document</button>
          </div>
        </form>

        <div class="list" style="margin-top:12px">
          ${
            documents.length
              ? documents.map((doc, idx) => `
            <div class="item" style="padding:10px">
              <div class="item-title">${esc(doc.doc_type || doc.type || "Document")}</div>
              <div class="item-sub">${esc(doc.file_name || "No file selected")}</div>
              <div class="item-sub">${esc(doc.mime_type || "Uploaded file")}</div>
              <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
                ${
                  doc.file_url
                    ? `<a href="${doc.file_url}" target="_blank" rel="noopener noreferrer">View</a>
                       <a href="${doc.file_url}" download="${esc(doc.file_name || "file")}">Download</a>`
                    : `<span style="opacity:.6">No file URL</span>`
                }
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
              <div class="item-title">${esc(p.currency || d.currency || "AED")} ${Number(p.amount || 0).toLocaleString("en-IN")}</div>
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

      <div class="item" style="margin-top:12px">
        <div class="item-title">Activity History</div>
        <div class="list" style="margin-top:10px">
          ${
            dealAuditLogs(d.id).length
              ? dealAuditLogs(d.id).map((log) => `
                <div class="item" style="padding:10px">
                  <div class="item-title">${esc(log.action || "update")}${log.field_name ? ` · ${esc(log.field_name)}` : ""}</div>
                  <div class="item-sub">Old: ${esc(formatAuditValue(log.old_value))}</div>
                  <div class="item-sub">New: ${esc(formatAuditValue(log.new_value))}</div>
                  <div class="item-sub">${esc(formatAuditTime(log.created_at))}</div>
                </div>
              `).join("")
              : `<div class="item-sub">No activity yet.</div>`
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

function buyerFormHtml(b = {}, edit = false, id = "") {
  return `
    <form id="${edit ? `buyer-edit-form-${id}` : "buyer-form"}" class="item" style="margin-bottom:12px">
      <div style="font-weight:800;margin-bottom:12px;color:#d4a646">${edit ? "Edit Buyer" : "New Buyer"}</div>
      <div style="display:grid;gap:10px">

        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Buyer Name</label>
          <input name="name" value="${esc(b.name || "")}" placeholder="Buyer name" required>
        </div>

        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Address</label>
          <textarea name="address" placeholder="Address" style="min-height:80px">${esc(b.address || "")}</textarea>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">GST</label>
            <input name="gst" value="${esc(b.gst || "")}" placeholder="GST">
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">IEC</label>
            <input name="iec" value="${esc(b.iec || "")}" placeholder="IEC">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">PAN</label>
            <input name="pan" value="${esc(b.pan || "")}" placeholder="PAN">
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Customer ID</label>
            <input
              name="customer_id"
              type="number"
              inputmode="numeric"
              min="1"
              step="1"
              value="${esc(b.customer_id || (edit ? "" : nextCustomerId()))}"
              placeholder="Customer ID"
            >
          </div>
        </div>

        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Phone</label>
          <input name="phone" value="${esc(b.phone || "")}" placeholder="Phone">
        </div>

        <div style="display:flex;gap:10px">
          <button type="submit" style="background:#d4a646;color:#fff;border:none">${edit ? "Update Buyer" : "Save Buyer"}</button>
          <button type="button" id="${edit ? `cancel-buyer-edit-${id}` : "cancel-buyer-form"}">Cancel</button>
        </div>
      </div>
    </form>
  `;
}

function supplierFormHtml(s = {}, edit = false, id = "") {
  return `
    <form id="${edit ? `supplier-edit-form-${id}` : "supplier-form"}" class="item" style="margin-bottom:12px">
      <div style="font-weight:800;margin-bottom:12px;color:#d4a646">${edit ? "Edit Supplier" : "New Supplier"}</div>
      <div style="display:grid;gap:10px">

        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Supplier Name</label>
          <input name="name" value="${esc(s.name || "")}" placeholder="Supplier name" required>
        </div>

        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Company Name</label>
          <input name="company_name" value="${esc(s.company_name || "")}" placeholder="Company name">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Country</label>
            <input name="country" value="${esc(s.country || "")}" placeholder="Country" required>
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Email</label>
            <input name="email" value="${esc(s.email || "")}" placeholder="Email">
          </div>
        </div>

        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Address</label>
          <textarea name="address" placeholder="Address" style="min-height:80px">${esc(s.address || "")}</textarea>
        </div>

        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Bank Name</label>
          <input name="bank_name" value="${esc(s.bank_name || "")}" placeholder="Bank name">
        </div>

        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Bank Account</label>
          <input name="bank_account" value="${esc(s.bank_account || "")}" placeholder="Bank account">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">IBAN</label>
            <input name="bank_iban" value="${esc(s.bank_iban || "")}" placeholder="IBAN">
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">SWIFT</label>
            <input name="bank_swift" value="${esc(s.bank_swift || "")}" placeholder="SWIFT">
          </div>
        </div>

        <div style="display:flex;gap:10px">
          <button type="submit" style="background:#d4a646;color:#fff;border:none">${edit ? "Update Supplier" : "Save Supplier"}</button>
          <button type="button" id="${edit ? `cancel-supplier-edit-${id}` : "cancel-supplier-form"}">Cancel</button>
        </div>
      </div>
    </form>
  `;
}

function nextDealNo() {
  const nums = state.deals
    .map((d) => String(d.deal_no || "").match(/JKP-(\d+)/))
    .filter(Boolean)
    .map((m) => Number(m[1] || 0));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `JKP-${String(next).padStart(3, "0")}`;
}

function dealFormHtml(d = {}, edit = false, id = "") {
  const labelId = edit ? `total-label-${id}` : "total-label";
  const currentDocCurrency = d.document_currency || d.currency || "USD";

  return `
    <form id="${edit ? `deal-edit-form-${id}` : "deal-form"}" class="item" style="margin-bottom:12px">
      <div style="font-weight:800;margin-bottom:12px;color:#d4a646">${edit ? "Edit Deal" : "New Deal"}</div>

      <div style="display:grid;gap:12px">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Deal Type</label>
            <select name="type" required>
              <option value="sell" ${d.type === "sell" ? "selected" : ""}>Sell</option>
              <option value="purchase" ${d.type === "purchase" ? "selected" : ""}>Purchase</option>
            </select>
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Deal No</label>
            <input name="deal_no" value="${esc(d.deal_no || nextDealNo())}" required>
          </div>
        </div>

        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Product Name</label>
          <input name="product_name" value="${esc(d.product_name || "")}" placeholder="Product name" required>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">HSN Code</label>
            <input name="hsn_code" value="${esc(d.hsn_code || "")}" placeholder="HSN Code">
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Unit</label>
            <input name="unit" value="${esc(d.unit || "MTON")}" placeholder="Unit">
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Base Currency</label>
            <select name="base_currency" id="${edit ? `base-currency-${id}` : "base-currency"}">
              <option value="USD" ${(d.base_currency || "USD") === "USD" ? "selected" : ""}>USD</option>
              <option value="AED" ${d.base_currency === "AED" ? "selected" : ""}>AED</option>
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">
  <div>
    <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Conversion Rate (USD → AED)</label>
    <input name="conversion_rate" id="${edit ? `conversion-rate-${id}` : "conversion-rate"}" type="number" step="0.0001" value="${esc(d.conversion_rate || "")}" placeholder="e.g. 3.6725">
  </div>
  <div>
    <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Document Currency</label>
    <select name="document_currency">
      <option value="AED" ${currentDocCurrency === "AED" ? "selected" : ""}>AED</option>
      <option value="USD" ${currentDocCurrency === "USD" ? "selected" : ""}>USD</option>
    </select>
  </div>
  <div>
    <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Status</label>
    <select name="status">
      <option value="active" ${d.status === "active" ? "selected" : ""}>active</option>
      <option value="shipped" ${d.status === "shipped" ? "selected" : ""}>shipped</option>
      <option value="invoiced" ${d.status === "invoiced" ? "selected" : ""}>invoiced</option>
      <option value="completed" ${d.status === "completed" ? "selected" : ""}>completed</option>
    </select>
  </div>
  <div>
    <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Approval Status</label>
    <select name="approval_status">
      <option value="draft" ${(d.approval_status || "draft") === "draft" ? "selected" : ""}>draft</option>
      <option value="under_review" ${d.approval_status === "under_review" ? "selected" : ""}>under_review</option>
      <option value="approved" ${d.approval_status === "approved" ? "selected" : ""}>approved</option>
      <option value="locked" ${d.approval_status === "locked" ? "selected" : ""}>locked</option>
    </select>
  </div>
</div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Quantity</label>
            <input name="quantity" id="${edit ? `quantity-${id}` : "quantity"}" type="number" step="0.001" value="${esc(d.quantity || "")}">
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Rate</label>
            <input name="rate" id="${edit ? `rate-${id}` : "rate"}" type="number" step="0.01" value="${esc(d.rate || "")}">
          </div>
          <div>
            <label id="${labelId}" style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Total (${esc(currentDocCurrency)})</label>
            <input name="total_amount" id="${edit ? `total-${id}` : "total"}" type="number" step="0.01" value="${esc(d.total_amount || "")}" readonly>
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Total (AED)</label>
            <input name="total_amount_aed" id="${edit ? `total-aed-${id}` : "total-aed"}" type="number" step="0.01" value="${esc(d.total_amount_aed || "")}" readonly>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Loading Port</label>
            <input name="loading_port" value="${esc(d.loading_port || "")}">
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Discharge Port</label>
            <input name="discharge_port" value="${esc(d.discharge_port || "")}">
          </div>
        </div>

        <div class="card">
          <div class="title">Shipment Details</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Vessel Name</label>
              <input name="vessel" value="${esc(d.vessel || "")}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Vessel / Voyage</label>
              <input name="vessel_voyage" value="${esc(d.vessel_voyage || "")}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Shipment Out Date</label>
              <input name="shipment_out_date" type="date" value="${esc(d.shipment_out_date || "")}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">ETA</label>
              <input name="eta" type="date" value="${esc(d.eta || "")}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Freight Type</label>
              <input name="freight_type" value="${esc(d.freight_type || "BY SEA")}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Shipment Status</label>
              <select name="shipment_status">
                <option value="pending" ${d.shipment_status === "pending" ? "selected" : ""}>Pending</option>
                <option value="in_transit" ${d.shipment_status === "in_transit" ? "selected" : ""}>In Transit</option>
                <option value="delivered" ${d.shipment_status === "delivered" ? "selected" : ""}>Delivered</option>
              </select>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="title">Packing / BL / Weight</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Gross Weight</label>
              <input name="gross_weight" type="number" step="0.001" value="${esc(d.gross_weight || "")}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Net Weight</label>
              <input name="net_weight" type="number" step="0.001" value="${esc(d.net_weight || "")}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Package Details</label>
              <input name="package_details" value="${esc(d.package_details || "20ft x 10 Containers")}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Loaded On</label>
              <input name="loaded_on" value="${esc(d.loaded_on || "ISO TANK")}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">BL No</label>
              <input name="bl_no" value="${esc(d.bl_no || "")}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">CFS</label>
              <input name="cfs" value="${esc(d.cfs || "")}">
            </div>
          </div>
          <div style="margin-top:10px">
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Container Numbers (comma separated)</label>
            <textarea name="container_numbers" style="min-height:90px">${esc(d.container_numbers || "")}</textarea>
          </div>
        </div>

        <div class="card">
          <div class="title">Document / Terms</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Country of Origin</label>
              <input name="country_of_origin" value="${esc(d.country_of_origin || "")}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Invoice Date</label>
              <input name="invoice_date" type="date" value="${esc(d.invoice_date || "")}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">PI No</label>
              <input name="pi_no" value="${esc(d.pi_no || "")}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">CI No</label>
              <input name="ci_no" value="${esc(d.ci_no || "")}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">PL No</label>
              <input name="pl_no" value="${esc(d.pl_no || "")}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">COO No</label>
              <input name="coo_no" value="${esc(d.coo_no || "")}">
            </div>
          </div>

          <div style="margin-top:10px">
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Terms of Delivery</label>
            <input name="terms_delivery" value="${esc(d.terms_delivery || "")}">
          </div>
          <div style="margin-top:10px">
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Payment Terms</label>
            <input name="payment_terms" value="${esc(d.payment_terms || "")}">
          </div>
          <div style="margin-top:10px">
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Bank Terms</label>
            <input name="bank_terms" value="${esc(d.bank_terms || "ALL BANKS ON BUYERS ACC. ONLY")}">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Buyer</label>
            <select name="buyer_id">
              <option value="">Select buyer</option>
              ${state.buyers.map((b) => `<option value="${b.id}" ${String(d.buyer_id) === String(b.id) ? "selected" : ""}>${esc(b.name)}</option>`).join("")}
            </select>
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Supplier</label>
            <select name="supplier_id">
              <option value="">Select supplier</option>
              ${state.suppliers.map((s) => `<option value="${s.id}" ${String(d.supplier_id) === String(s.id) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
            </select>
          </div>
        </div>

        <div style="display:flex;gap:10px">
          <button type="submit" style="background:#d4a646;color:#fff;border:none">${edit ? "Update Deal" : "Save Deal"}</button>
          <button type="button" id="${edit ? `cancel-deal-edit-${id}` : "cancel-deal-form"}">Cancel</button>
        </div>
      </div>
    </form>
  `;
}

function showBuyerForm() {
  const wrap = document.getElementById("buyer-form-wrap");
  if (!wrap) return;
  wrap.innerHTML = buyerFormHtml();
  document.getElementById("buyer-form").addEventListener("submit", saveBuyer);
  document.getElementById("cancel-buyer-form").addEventListener("click", () => (wrap.innerHTML = ""));
}

function showSupplierForm() {
  const wrap = document.getElementById("supplier-form-wrap");
  if (!wrap) return;
  wrap.innerHTML = supplierFormHtml();
  document.getElementById("supplier-form").addEventListener("submit", saveSupplier);
  document.getElementById("cancel-supplier-form").addEventListener("click", () => (wrap.innerHTML = ""));
}

function showDealForm() {
  const wrap = document.getElementById("deal-form-wrap");
  if (!wrap) return;
  wrap.innerHTML = dealFormHtml({}, false);
  document.getElementById("deal-form").addEventListener("submit", saveDeal);
  document.getElementById("cancel-deal-form").addEventListener("click", () => (wrap.innerHTML = ""));
  bindDealAutoTotal(false);
}

function showEditBuyerForm(id) {
  const b = state.buyers.find((x) => String(x.id) === String(id));
  const wrap = document.getElementById(`buyer-edit-wrap-${id}`);
  if (!b || !wrap) return;
  wrap.innerHTML = buyerFormHtml(b, true, id);
  document.getElementById(`buyer-edit-form-${id}`).addEventListener("submit", (e) => updateBuyer(e, id));
  document.getElementById(`cancel-buyer-edit-${id}`).addEventListener("click", () => (wrap.innerHTML = ""));
}

function showEditSupplierForm(id) {
  const s = state.suppliers.find((x) => String(x.id) === String(id));
  const wrap = document.getElementById(`supplier-edit-wrap-${id}`);
  if (!s || !wrap) return;
  wrap.innerHTML = supplierFormHtml(s, true, id);
  document.getElementById(`supplier-edit-form-${id}`).addEventListener("submit", (e) => updateSupplier(e, id));
  document.getElementById(`cancel-supplier-edit-${id}`).addEventListener("click", () => (wrap.innerHTML = ""));
}

function showEditDealForm(id) {
  const deal = state.deals.find((d) => String(d.id) === String(id));
  const wrap = document.getElementById(`deal-edit-wrap-${id}`);
  if (!deal || !wrap) return;
  wrap.innerHTML = dealFormHtml(deal, true, id);
  document.getElementById(`deal-edit-form-${id}`).addEventListener("submit", (e) => updateDeal(e, id));
  document.getElementById(`cancel-deal-edit-${id}`)?.addEventListener("click", () => (wrap.innerHTML = ""));
  bindDealAutoTotal(true, id);
}

function showPaymentForm(dealId) {
  const wrap = document.getElementById(`payment-form-wrap-${dealId}`);
  const deal = state.deals.find((d) => String(d.id) === String(dealId));
  if (!wrap || !deal) return;

  const banks = state.company.bankAccounts || [];

  wrap.innerHTML = `
    <form data-payment-form="${dealId}" class="item" style="margin-top:10px">
      <div style="font-weight:800;margin-bottom:12px;color:#d4a646">New Payment</div>
      <div style="display:grid;gap:10px">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Direction</label>
            <select name="direction" required>
              <option value="in">Payment In</option>
              <option value="out">Payment Out</option>
            </select>
          </div>

          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Amount</label>
            <input name="amount" type="number" step="0.01" placeholder="Amount" required>
          </div>
        </div>

        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Payment Mode</label>
          <select name="payment_mode" id="payment-mode" required>
            <option value="">Select Mode</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank Transfer</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div id="bank-wrapper" style="display:none">
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Bank Account</label>
          <select name="method" id="bank-select">
            <option value="">Select Bank</option>
            ${banks.map((b) => `
              <option value="${esc(`${b.bankName} - ${b.account}`)}">
                ${esc(b.bankName)} (${esc(b.account)})
              </option>
            `).join("")}
          </select>
        </div>

        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Currency</label>
          <input name="currency" value="${esc(deal.currency || "AED")}">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Reference</label>
            <input name="ref" placeholder="Reference">
          </div>

          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Status</label>
            <select name="status">
              <option value="received">Received</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Payment Date</label>
          <input name="payment_date" type="date" required>
        </div>

        <div style="display:flex;gap:10px">
          <button type="submit" style="background:#d4a646;color:#fff;border:none">Save Payment</button>
          <button type="button" data-cancel-payment-form="${dealId}">Cancel</button>
        </div>
      </div>
    </form>
  `;

  const modeSelect = wrap.querySelector("#payment-mode");
  const bankWrapper = wrap.querySelector("#bank-wrapper");
  const bankSelect = wrap.querySelector("#bank-select");

  modeSelect.addEventListener("change", () => {
    if (modeSelect.value === "bank") {
      bankWrapper.style.display = "block";
    } else {
      bankWrapper.style.display = "none";
      if (bankSelect) bankSelect.value = "";
    }
  });

  wrap.querySelector(`[data-payment-form="${dealId}"]`)?.addEventListener("submit", (e) => savePayment(e, dealId));
  wrap.querySelector(`[data-cancel-payment-form="${dealId}"]`)?.addEventListener("click", () => (wrap.innerHTML = ""));
}

async function saveCompanySettings(e) {
  e.preventDefault();
  const fd = new FormData(e.target);

  const companyData = {
    id: 1,
    name: fd.get("name") || "",
    address: fd.get("address") || "",
    bank_accounts: state.company.bankAccounts || []
  };

  const { error } = await supabase.from("company_settings").upsert(companyData, { onConflict: "id" });
  if (error) return alert(error.message);

  state.company = {
    ...state.company,
    id: 1,
    name: companyData.name,
    address: companyData.address,
    bankAccounts: companyData.bank_accounts
  };

  alert("Saved successfully ✅");
  setPage("dashboard");
}

async function loadCompanySettings() {
  const { data, error } = await supabase.from("company_settings").select("*").eq("id", 1).maybeSingle();
  if (error) return;
  if (data) {
    state.company = {
      ...state.company,
      id: data.id,
      name: data.name || state.company.name,
      address: data.address || state.company.address,
      bankAccounts: data.bank_accounts || []
    };
  }
}

function addBankAccount() {
  const bankName = prompt("Enter Bank Name");
  const account = prompt("Enter Account Number");
  const iban = prompt("Enter IBAN");
  const swift = prompt("Enter SWIFT");

  if (!bankName || !account) {
    alert("Bank name and account are required");
    return;
  }

  if (!state.company.bankAccounts) state.company.bankAccounts = [];
  state.company.bankAccounts.push({ bankName, account, iban, swift });
  render();
}

function getPrimaryBank(company = {}) {
  const first = company.bankAccounts?.[0];
  if (!first) return company;
  return {
    ...company,
    bankName: first.bankName || "",
    bankAccount: first.account || "",
    bankIBAN: first.iban || "",
    bankSWIFT: first.swift || ""
  };
}

function printDoc(type, dealId) {
  const deal = state.deals.find((d) => String(d.id) === String(dealId));
  if (!deal) return;

  const buyer = state.buyers.find((b) => String(b.id) === String(deal.buyer_id));
  const supplierRaw = state.suppliers.find((s) => String(s.id) === String(deal.supplier_id));
  const supplier = supplierRaw
    ? {
        ...supplierRaw,
        companyName: supplierRaw.company_name,
        bankName: supplierRaw.bank_name,
        bankAccount: supplierRaw.bank_account,
        bankIBAN: supplierRaw.bank_iban,
        bankSWIFT: supplierRaw.bank_swift
      }
    : null;

  // replace here
  const currency = deal.document_currency || deal.currency || deal.base_currency || "AED";

  const dealDoc = {
    ...deal,
    currency,
    rate: currency === "USD"
      ? (deal.rate_usd ?? deal.rate)
      : (deal.rate_aed ?? deal.rate),
    totalAmount: currency === "USD"
      ? (deal.total_amount_usd ?? deal.total_amount)
      : (deal.total_amount_aed ?? deal.total_amount),
    dealNo: deal.deal_no,
    productName: deal.product_name,
    loadingPort: deal.loading_port,
    dischargePort: deal.discharge_port,
    hsn: deal.hsn_code
  };

  const companyForDocs = getPrimaryBank(state.company);

  let html = "";
  if (type === "pi") html = buildPI(dealDoc, buyer, supplier, companyForDocs);
  if (type === "ci") html = buildCI(dealDoc, buyer, supplier, companyForDocs);
  if (type === "pl") html = buildPL(dealDoc, buyer, supplier, companyForDocs);
  if (type === "coo") html = buildCOO(dealDoc, buyer, supplier, companyForDocs);

  if (!html) return;
  const ok = openPrintWindow(html);
  if (!ok) alert("Popup blocked. Please allow popups for this site.");
}

async function saveBuyer(e) {
  e.preventDefault();
  const fd = new FormData(e.target);

  const customerId = normalizeCustomerId(fd.get("customer_id"));

  if (!customerId) {
    alert("Customer ID is required");
    return;
  }

  const duplicate = state.buyers.find((b) => normalizeCustomerId(b.customer_id) === customerId);
  if (duplicate) {
    alert("Customer ID already exists");
    return;
  }

  const { error } = await supabase.from("buyers").insert({
    name: fd.get("name") || "",
    address: fd.get("address") || "",
    gst: fd.get("gst") || "",
    iec: fd.get("iec") || "",
    pan: fd.get("pan") || "",
    customer_id: customerId,
    phone: fd.get("phone") || ""
  });

  if (error) return alert(error.message);
  await loadSupabaseData();
  setPage("buyers");
}

async function updateBuyer(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);

  const customerId = normalizeCustomerId(fd.get("customer_id"));

  if (!customerId) {
    alert("Customer ID is required");
    return;
  }

  const duplicate = state.buyers.find(
    (b) =>
      String(b.id) !== String(id) &&
      normalizeCustomerId(b.customer_id) === customerId
  );

  if (duplicate) {
    alert("Customer ID already exists");
    return;
  }

  const { error } = await supabase
    .from("buyers")
    .update({
      name: fd.get("name") || "",
      address: fd.get("address") || "",
      gst: fd.get("gst") || "",
      iec: fd.get("iec") || "",
      pan: fd.get("pan") || "",
      customer_id: customerId,
      phone: fd.get("phone") || ""
    })
    .eq("id", id);

  if (error) return alert(error.message);
  await loadSupabaseData();
  setPage("buyers");
}

async function deleteBuyer(id) {
  if (!confirm("Delete this buyer?")) return;
  const { error } = await supabase.from("buyers").delete().eq("id", id);
  if (error) return alert(error.message);
  await loadSupabaseData();
  setPage("buyers");
}

async function saveSupplier(e) {
  e.preventDefault();
  const fd = new FormData(e.target);

  const { error } = await supabase.from("suppliers").insert({
    name: fd.get("name") || "",
    company_name: fd.get("company_name") || "",
    country: fd.get("country") || "",
    email: fd.get("email") || "",
    address: fd.get("address") || "",
    bank_name: fd.get("bank_name") || "",
    bank_account: fd.get("bank_account") || "",
    bank_iban: fd.get("bank_iban") || "",
    bank_swift: fd.get("bank_swift") || ""
  });

  if (error) return alert(error.message);
  await loadSupabaseData();
  setPage("suppliers");
}

async function updateSupplier(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);

  const { error } = await supabase
    .from("suppliers")
    .update({
      name: fd.get("name") || "",
      company_name: fd.get("company_name") || "",
      country: fd.get("country") || "",
      email: fd.get("email") || "",
      address: fd.get("address") || "",
      bank_name: fd.get("bank_name") || "",
      bank_account: fd.get("bank_account") || "",
      bank_iban: fd.get("bank_iban") || "",
      bank_swift: fd.get("bank_swift") || ""
    })
    .eq("id", id);

  if (error) return alert(error.message);
  await loadSupabaseData();
  setPage("suppliers");
}

async function deleteSupplier(id) {
  if (!confirm("Delete this supplier?")) return;
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return alert(error.message);
  await loadSupabaseData();
  setPage("suppliers");
}

function validateDeal(fd) {
  const type = cleanText(fd.get("type") || "sell");
  const deal_no = cleanText(fd.get("deal_no"));
  const product_name = cleanText(fd.get("product_name"));
  const hsn_code = cleanText(fd.get("hsn_code"));
  const unit = cleanText(fd.get("unit") || "MTON");

  const base_currency = cleanText(fd.get("base_currency") || "USD");
  const document_currency = cleanText(fd.get("document_currency") || base_currency);
  const conversion_rate = cleanNumber(fd.get("conversion_rate"));

  const quantity = cleanNumber(fd.get("quantity"));
  const rate = cleanNumber(fd.get("rate"));

  let total_amount_usd = 0;
  let total_amount_aed = 0;
  let rate_usd = 0;
  let rate_aed = 0;

  if (base_currency === "USD") {
    rate_usd = rate;
    rate_aed = conversion_rate ? rate * conversion_rate : 0;
    total_amount_usd = quantity * rate_usd;
    total_amount_aed = conversion_rate ? total_amount_usd * conversion_rate : 0;
  } else {
    rate_aed = rate;
    rate_usd = conversion_rate ? rate / conversion_rate : 0;
    total_amount_aed = quantity * rate_aed;
    total_amount_usd = conversion_rate ? total_amount_aed / conversion_rate : 0;
  }

  const total_amount = document_currency === "USD" ? total_amount_usd : total_amount_aed;
  const currency = document_currency;
  const status = cleanText(fd.get("status") || "active");
  const approval_status = cleanText(fd.get("approval_status") || "draft");
  const loading_port = cleanText(fd.get("loading_port"));
  const discharge_port = cleanText(fd.get("discharge_port"));
  const buyer_id = cleanText(fd.get("buyer_id"));
  const supplier_id = cleanText(fd.get("supplier_id"));

  if (!deal_no) throw new Error("Deal no is required");
  if (!product_name) throw new Error("Product name is required");
  if (quantity <= 0) throw new Error("Quantity must be greater than 0");
  if (rate <= 0) throw new Error("Rate must be greater than 0");
  if (!loading_port) throw new Error("Loading port is required");
  if (!discharge_port) throw new Error("Discharge port is required");
  if (type === "sell" && !buyer_id) throw new Error("Buyer is required for sell deals");
  if (type === "purchase" && !supplier_id) throw new Error("Supplier is required for purchase deals");

  return {
    type,
    deal_no,
    product_name,
    hsn_code,
    unit,
    base_currency,
    document_currency,
    conversion_rate,
    currency,
    quantity,
    rate,
    rate_usd,
    rate_aed,
    total_amount,
    total_amount_usd,
    total_amount_aed,
    status,
    approval_status,
    loading_port,
    discharge_port,
    buyer_id: buyer_id || null,
    supplier_id: supplier_id || null,
    vessel: cleanText(fd.get("vessel")),
    vessel_voyage: cleanText(fd.get("vessel_voyage")),
    shipment_out_date: cleanText(fd.get("shipment_out_date")) || null,
    eta: cleanText(fd.get("eta")) || null,
    freight_type: cleanText(fd.get("freight_type") || "BY SEA"),
    shipment_status: cleanText(fd.get("shipment_status") || "pending"),
    gross_weight: cleanNumber(fd.get("gross_weight")) || null,
    net_weight: cleanNumber(fd.get("net_weight")) || null,
    package_details: cleanText(fd.get("package_details")),
    loaded_on: cleanText(fd.get("loaded_on")),
    container_numbers: cleanText(fd.get("container_numbers")),
    bl_no: cleanText(fd.get("bl_no")),
    cfs: cleanText(fd.get("cfs")),
    country_of_origin: cleanText(fd.get("country_of_origin")),
    terms_delivery: cleanText(fd.get("terms_delivery")),
    payment_terms: cleanText(fd.get("payment_terms")),
    bank_terms: cleanText(fd.get("bank_terms")),
    pi_no: cleanText(fd.get("pi_no")),
    ci_no: cleanText(fd.get("ci_no")),
    pl_no: cleanText(fd.get("pl_no")),
    coo_no: cleanText(fd.get("coo_no")),
    invoice_date: cleanText(fd.get("invoice_date")) || null
  };
}

async function saveDeal(e) {
  e.preventDefault();
  const fd = new FormData(e.target);

  try {
    let payload = validateDeal(fd);
    payload = ensureDocNumbers(payload);

    const { error } = await supabase.from("deals").insert(payload);
    if (error) throw error;

    await loadSupabaseData();
    setPage("deals");
  } catch (err) {
    alert(err.message || "Failed to save deal");
  }
}

async function updateDeal(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);

  try {
    const existing = state.deals.find((d) => String(d.id) === String(id));

    if (existing?.approval_status === "locked") {
      alert("Locked deals cannot be edited");
      return;
    }

    let payload = validateDeal(fd);
    payload = ensureDocNumbers(payload, existing);

    const { error } = await supabase
      .from("deals")
      .update(payload)
      .eq("id", id);

    if (error) throw error;

    await loadSupabaseData();
    setPage("deals");
  } catch (err) {
    alert(err.message || "Failed to update deal");
  }
}

async function deleteDeal(id) {
  if (!confirm("Delete this deal?")) return;
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) return alert(error.message);
  await loadSupabaseData();
  setPage("deals");
}

async function savePayment(e, dealId) {
  e.preventDefault();

  const fd = new FormData(e.target);
  const direction = fd.get("direction");
  const amount = Number(fd.get("amount"));
  const currency = fd.get("currency") || "AED";
  const ref = fd.get("ref") || "";
  const status = fd.get("status") || "received";
  const payment_date = fd.get("payment_date");
  const payment_mode = fd.get("payment_mode");

  let method = "";
  if (payment_mode === "bank") {
    method = fd.get("method");
    if (!method) return alert("Please select a bank");
  } else {
    method = payment_mode;
  }

  if (!amount || amount <= 0) return alert("Amount must be greater than 0");
  if (!payment_mode) return alert("Please select payment mode");
  if (!payment_date) return alert("Please select payment date");

  const { error } = await supabase.from("payments").insert({
    deal_id: dealId,
    direction,
    amount,
    currency,
    method,
    payment_mode,
    ref,
    status,
    payment_date
  });

  if (error) return alert(error.message);

  alert("Payment saved successfully ✅");
  await loadSupabaseData();
  if (state.page === "dealDetail") render();
  else setPage("deals");
}

async function deletePayment(dealId, paymentId) {
  if (!confirm("Delete this payment?")) return;
  const { error } = await supabase.from("payments").delete().eq("id", paymentId).eq("deal_id", dealId);
  if (error) return alert(error.message);
  await loadSupabaseData();
  if (state.page === "dealDetail") render();
  else setPage("deals");
}

async function savePlaceholderDocument(e, dealId) {
  e.preventDefault();

  try {
    const fd = new FormData(e.target);
    const docType = cleanText(fd.get("docType"));
    const file = fd.get("file");

    if (!file || !file.name) {
      alert("Please select a file");
      return;
    }

    await uploadDealDocument(file, dealId, docType || "Other");

    alert("Document uploaded successfully ✅");
    await loadSupabaseData();

    if (state.page === "dealDetail") render();
    else setPage("deals");

    e.target.reset();
  } catch (err) {
    alert(err.message || "Failed to upload document");
  }
}

async function deletePlaceholderDocument(dealId, index) {
  const list = state.documentsByDeal[String(dealId)] || [];
  const doc = list[index];
  if (!doc) return;

  if (!confirm("Delete this document?")) return;

  try {
    await deleteDealDocument(doc);
    await loadSupabaseData();
    if (state.page === "dealDetail") render();
    else setPage("deals");
  } catch (err) {
    alert(err.message || "Failed to delete document");
  }
}
async function uploadDealDocument(file, dealId, docType = "Other") {
  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `${dealId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("deal-documents")
    .upload(filePath, file, {
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from("deal-documents")
    .getPublicUrl(filePath);

  const fileUrl = publicUrlData?.publicUrl || null;

  const { error: dbError } = await supabase
    .from("deal_documents")
    .insert({
      deal_id: dealId,
      doc_type: docType,
      file_name: file.name,
      file_path: filePath,
      file_url: fileUrl,
      mime_type: file.type || null,
      file_size: file.size || null
    });

  if (dbError) throw dbError;

  return { filePath, fileUrl };
}
async function deleteDealDocument(doc) {
  if (doc.file_path) {
    const { error: storageError } = await supabase.storage
      .from("deal-documents")
      .remove([doc.file_path]);

    if (storageError) throw storageError;
  }

  const { error: dbError } = await supabase
    .from("deal_documents")
    .delete()
    .eq("id", doc.id);

  if (dbError) throw dbError;
}
async function loadSupabaseData() {
  try {
    const [buyersRes, suppliersRes, dealsRes, paymentsRes, documentsRes, auditRes] = await Promise.all([
      supabase.from("buyers").select("*").order("id", { ascending: false }),
      supabase.from("suppliers").select("*").order("id", { ascending: false }),
      supabase.from("deals").select("*").order("id", { ascending: false }),
      supabase.from("payments").select("*").order("id", { ascending: false }),
      supabase.from("deal_documents").select("*").eq("is_deleted", false).order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false })
    ]);

    if (buyersRes.error) throw buyersRes.error;
    if (suppliersRes.error) throw suppliersRes.error;
    if (dealsRes.error) throw dealsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;
    if (documentsRes.error) throw documentsRes.error;
    if (auditRes.error) throw auditRes.error;

    state.buyers = buyersRes.data || [];
    state.suppliers = suppliersRes.data || [];
    state.deals = dealsRes.data || [];

    const groupedPayments = {};
    (paymentsRes.data || []).forEach((p) => {
      const key = String(p.deal_id);
      if (!groupedPayments[key]) groupedPayments[key] = [];
      groupedPayments[key].push(p);
    });
    state.paymentsByDeal = groupedPayments;

    const groupedDocuments = {};
    (documentsRes.data || []).forEach((doc) => {
      const key = String(doc.deal_id);
      if (!groupedDocuments[key]) groupedDocuments[key] = [];
      groupedDocuments[key].push(doc);
    });
    state.documentsByDeal = groupedDocuments;

    const groupedAudit = {};
    (auditRes.data || []).forEach((log) => {
      const key = `${log.entity_type}:${log.entity_id}`;
      if (!groupedAudit[key]) groupedAudit[key] = [];
      groupedAudit[key].push(log);
    });
    state.auditLogsByEntity = groupedAudit;

    await loadCompanySettings();

    state.error = "";
    state.ready = true;
  } catch (err) {
    console.error(err);
    state.error = err.message || "Failed to load Supabase data";
    state.ready = false;
  }

  render();
}

function exportDealsCsv() {
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

  const rows = [[
    "Deal No", "Type", "Product", "HSN Code", "Buyer", "Supplier", "Loading Port", "Discharge Port", "Currency", "Total Amount", "Status"
  ]];

  filteredDeals.forEach((d) => {
    rows.push([
      d.deal_no || "",
      d.type || "",
      d.product_name || "",
      d.hsn_code || "",
      buyerName(d.buyer_id),
      supplierName(d.supplier_id),
      d.loading_port || "",
      d.discharge_port || "",
      d.currency || "AED",
      d.total_amount || 0,
      d.status || ""
    ]);
  });

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = q ? "deals-filtered-export.csv" : "deals-export.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

render();
loadSupabaseData();