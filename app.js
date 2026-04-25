import { openPrintWindow, buildPI, buildCI, buildPL, buildCOO, buildShippingInstruction, buildSupplierStatement, buildBuyerStatement } from "./documents.js";
import { supabase } from "./supabase.js";
import { state, buyerName, supplierName, getBuyerById, getDealById, getShipperOptions, paymentsForDeal, paymentSummary } from "./state.js";
import { esc, cleanText, cleanUpper, cleanNumber, normalizeCustomerId, ensureDocNumbers } from "./utils.js";

// Import Views (Flat Structure)
import { dashboardView } from "./dashboard.js";
import { buyersView, buyerFormHtml } from "./buyers.js";
import { suppliersView, supplierFormHtml } from "./suppliers.js";
import { dealsView, dealFormHtml } from "./deals.js";
import { dealDetailView } from "./dealDetail.js";
import { settingsView } from "./settings.js";
import { shippingInstructionsView } from "./shipping.js";
import { productsView, productEditFormHtml } from "./products.js";

console.log("APP STARTING - VERSION 12");

const content = document.getElementById("content");

/**
 * ROUTING
 */
function navigate(path) {
  window.location.hash = path;
}

function handleRoute() {
  const hash = window.location.hash || "#/";

  if (hash.startsWith("#/deals/")) {
    state.selectedDealId = hash.split("/")[2];
    state.page = "dealDetail";
  } else if (hash === "#/buyers") {
    state.page = "buyers";
  } else if (hash === "#/suppliers") {
    state.page = "suppliers";
  } else if (hash === "#/settings") {
    state.page = "settings";
  } else if (hash === "#/deals") {
    state.page = "deals";
  } else if (hash === "#/shipping") {
    state.page = "shippingInstructions";
  } else if (hash === "#/products") {
    state.page = "products";
  } else {
    state.page = "dashboard";
  }

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === state.page);
  });

  render();
}

window.addEventListener("hashchange", handleRoute);

/**
 * AUTH
 */
async function loginUser(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(fd.get("email")).trim(),
    password: String(fd.get("password")).trim()
  });
  if (error) return alert(error.message);
  state.authUser = data.user;
  await loadSupabaseData();
}

async function logoutUser() {
  await supabase.auth.signOut();
  state.authUser = null;
  render();
}

async function loadSession() {
  const { data } = await supabase.auth.getSession();
  state.authUser = data.session?.user || null;
  if (state.authUser) await loadSupabaseData();
  else render();
}

/**
 * DATA
 */
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

    state.buyers = buyersRes.data || [];
    console.log("FETCHED BUYERS COUNT:", state.buyers.length);
    state.suppliers = suppliersRes.data || [];
    state.deals = dealsRes.data || [];

    const groupedPayments = {};
    (paymentsRes.data || []).forEach(p => {
      const k = String(p.deal_id);
      if (!groupedPayments[k]) groupedPayments[k] = [];
      groupedPayments[k].push(p);
    });
    state.paymentsByDeal = groupedPayments;

    const groupedDocs = {};
    console.log("FETCHED DOCS COUNT:", (documentsRes.data || []).length);
    (documentsRes.data || []).forEach(doc => {
      const k = String(doc.deal_id);
      if (!groupedDocs[k]) groupedDocs[k] = [];
      groupedDocs[k].push(doc);
    });
    console.log("GROUPED DOCS:", groupedDocs);
    state.documentsByDeal = groupedDocs;

    const groupedAudit = {};
    (auditRes.data || []).forEach(log => {
      const k = `${log.entity_type}:${log.entity_id}`;
      if (!groupedAudit[k]) groupedAudit[k] = [];
      groupedAudit[k].push(log);
    });
    state.auditLogsByEntity = groupedAudit;

    await loadCompanySettings();
    await loadProducts();
    await loadShippingInstructions();

    state.ready = true;
  } catch (err) {
    console.error("Load failed:", err);
  }
  handleRoute();
}

async function loadCompanySettings() {
  const { data } = await supabase.from("company_settings").select("*").eq("id", 1).maybeSingle();
  if (data) {
    state.company = {
      ...state.company,
      id: data.id,
      name: data.name || state.company.name,
      address: data.address || state.company.address,
      mobile: data.mobile || state.company.mobile,
      email: data.email || state.company.email,
      gemini_api_key: data.gemini_api_key || "",
      gemini_model: data.gemini_model || localStorage.getItem("gemini_model") || "gemini-2.5-flash",
      bankAccounts: Array.isArray(data.bank_accounts) ? data.bank_accounts : [],
      shippers: Array.isArray(data.shippers) ? data.shippers : []
    };
  }
}

async function loadProducts() {
  const { data } = await supabase.from("products").select("*").order("name", { ascending: true });
  if (data) state.products = data;
}

async function loadShippingInstructions() {
  const { data } = await supabase.from("shipping_instructions").select("*").order("id", { ascending: false });
  if (data) state.shippingInstructions = data;
}

/**
 * RENDERING
 */
function render() {
  console.log("Rendering page:", state.page);
  if (!state.authUser) {
    content.innerHTML = loginView();
    bindUI();
    return;
  }

  if (state.page === "dashboard") content.innerHTML = dashboardView();
  else if (state.page === "buyers") content.innerHTML = buyersView();
  else if (state.page === "suppliers") content.innerHTML = suppliersView();
  else if (state.page === "deals") content.innerHTML = dealsView();
  else if (state.page === "dealDetail") content.innerHTML = dealDetailView();
  else if (state.page === "shippingInstructions") content.innerHTML = shippingInstructionsView();
  else if (state.page === "products") content.innerHTML = productsView();
  else if (state.page === "settings") content.innerHTML = settingsView();

  bindUI();
}

function bindUI() {
  console.log("Binding UI for page:", state.page);
  document.getElementById("login-form")?.addEventListener("submit", loginUser);
  document.getElementById("logout-btn")?.addEventListener("click", logoutUser);
  
  // Navigation
  document.getElementById("show-buyer-form")?.addEventListener("click", showBuyerForm);
  document.getElementById("show-supplier-form")?.addEventListener("click", showSupplierForm);
  document.getElementById("show-deal-form")?.addEventListener("click", showDealForm);
  document.getElementById("back-to-deals")?.addEventListener("click", () => navigate("#/deals"));
  document.getElementById("open-company-settings")?.addEventListener("click", () => navigate("#/settings"));
  document.getElementById("product-form")?.addEventListener("submit", saveProduct);
  
  document.querySelectorAll("[data-ai-scan]").forEach(btn => btn.addEventListener("click", () => {
    const [dealId, docId] = btn.dataset.aiScan.split(":");
    runAiScan(dealId, docId);
  }));

  document.getElementById("check-ai-btn")?.addEventListener("click", checkAiConnection);

  // Search
  document.getElementById("deal-search")?.addEventListener("input", (e) => { state.dealSearch = e.target.value; render(); });
  document.getElementById("buyer-search")?.addEventListener("input", (e) => { state.buyerSearch = e.target.value; render(); });
  document.getElementById("supplier-search")?.addEventListener("input", (e) => { state.supplierSearch = e.target.value; render(); });

  // List Actions
  document.querySelectorAll("[data-open-deal]").forEach(btn => btn.addEventListener("click", () => navigate("#/deals/" + btn.dataset.openDeal)));
  document.querySelectorAll("[data-edit-buyer]").forEach(btn => btn.addEventListener("click", () => showEditBuyerForm(btn.dataset.editBuyer)));
  document.querySelectorAll("[data-delete-buyer]").forEach(btn => btn.addEventListener("click", () => deleteBuyer(btn.dataset.deleteBuyer)));
  document.querySelectorAll("[data-edit-supplier]").forEach(btn => btn.addEventListener("click", () => showEditSupplierForm(btn.dataset.editSupplier)));
  document.querySelectorAll("[data-delete-supplier]").forEach(btn => btn.addEventListener("click", () => deleteSupplier(btn.dataset.deleteSupplier)));
  document.querySelectorAll("[data-edit-deal]").forEach(btn => btn.addEventListener("click", () => showEditDealForm(btn.dataset.editDeal)));
  document.querySelectorAll("[data-delete-deal]").forEach(btn => btn.addEventListener("click", () => deleteDeal(btn.dataset.deleteDeal)));
  document.querySelectorAll("[data-edit-product]").forEach(btn => btn.addEventListener("click", () => showEditProductForm(btn.dataset.editProduct)));
  document.querySelectorAll("[data-delete-product]").forEach(btn => btn.addEventListener("click", () => deleteProduct(btn.dataset.deleteProduct)));
  
  // Print
  document.querySelectorAll("[data-print-pi]").forEach(btn => btn.addEventListener("click", () => printDoc("pi", btn.dataset.printPi)));
  document.querySelectorAll("[data-print-ci]").forEach(btn => btn.addEventListener("click", () => printDoc("ci", btn.dataset.printCi)));
  document.querySelectorAll("[data-print-pl]").forEach(btn => btn.addEventListener("click", () => printDoc("pl", btn.dataset.printPl)));
  document.querySelectorAll("[data-print-coo]").forEach(btn => btn.addEventListener("click", () => printDoc("coo", btn.dataset.printCoo)));
  document.querySelectorAll("[data-print-supplier-statement]").forEach(btn => btn.addEventListener("click", () => printDoc("supplier-statement", btn.dataset.printSupplierStatement)));
  document.querySelectorAll("[data-print-buyer-statement]").forEach(btn => btn.addEventListener("click", () => printDoc("buyer-statement", btn.dataset.printBuyerStatement)));

  // Payments and Docs
  document.querySelectorAll("[data-show-payment-form]").forEach(btn => btn.addEventListener("click", () => showPaymentForm(btn.dataset.showPaymentForm)));
  document.querySelectorAll("[data-edit-payment]").forEach(btn => btn.addEventListener("click", () => showEditPaymentForm(btn.dataset.editPayment)));
  document.querySelectorAll("[data-delete-payment]").forEach(btn => btn.addEventListener("click", () => deletePayment(btn.dataset.deletePayment)));
  document.querySelectorAll("[data-show-document-form]").forEach(btn => btn.addEventListener("click", () => showDocumentForm(btn.dataset.showDocumentForm)));
  
  // Settings
  document.getElementById("company-settings-form")?.addEventListener("submit", saveCompanySettings);
  document.getElementById("add-bank-btn")?.addEventListener("click", addBankAccount);
  document.getElementById("add-shipper-btn")?.addEventListener("click", addShipper);
  document.querySelectorAll("[data-delete-bank]").forEach(btn => btn.addEventListener("click", () => deleteBankAccount(btn.dataset.deleteBank)));
  document.querySelectorAll("[data-delete-shipper]").forEach(btn => btn.addEventListener("click", () => deleteShipper(btn.dataset.deleteShipper)));

  // Exports
  document.getElementById("export-deals-csv")?.addEventListener("click", exportDealsCsv);

   // Documents
  document.querySelectorAll("[data-placeholder-upload]").forEach(form => form.addEventListener("submit", saveDealDocument));
  document.querySelectorAll("[data-edit-document]").forEach(btn => btn.addEventListener("click", () => showEditDocumentForm(btn.dataset.editDocument)));
  document.querySelectorAll("[data-delete-placeholder-doc]").forEach(btn => btn.addEventListener("click", () => deleteDealDocument(btn.dataset.deletePlaceholderDoc)));

  // Shipping Instructions
  document.querySelectorAll("[data-delete-si]").forEach(btn => btn.addEventListener("click", () => deleteShippingInstruction(btn.dataset.deleteSi)));

  // Shipping Instructions
  bindShippingInstructionForm();

  // Auto-binding logic
  bindDealAutoTotal();
  bindProductHsnLookup();
}

/**
 * ROBUST HANDLERS
 */

function validateDeal(fd) {
  const quantity = cleanNumber(fd.get("quantity"));
  const rate = cleanNumber(fd.get("rate")); // Sale Rate
  const pRate = cleanNumber(fd.get("purchase_rate")); // Purchase Rate
  const conv = cleanNumber(fd.get("conversion_rate"));
  const baseCurr = fd.get("base_currency") || "USD";
  const docCurr = fd.get("document_currency") || baseCurr;

  let rateUsd = 0, rateAed = 0, totalUsd = 0, totalAed = 0;
  let pRateUsd = 0, pRateAed = 0, pTotalUsd = 0, pTotalAed = 0;

  if (baseCurr === "USD") {
    rateUsd = rate;
    rateAed = conv ? rate * conv : 0;
    pRateUsd = pRate;
    pRateAed = conv ? pRate * conv : 0;
  } else {
    rateAed = rate;
    rateUsd = conv ? rate / conv : 0;
    pRateAed = pRate;
    pRateUsd = conv ? pRate / conv : 0;
  }

  const round = (num) => Math.round((num + Number.EPSILON) * 100) / 100;
  
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
    conversion_rate: conv,
    quantity,
    rate, // Sale Rate
    purchase_rate: pRate, // Purchase Rate
    rate_usd: round(rateUsd),
    rate_aed: round(rateAed),
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
    container_numbers: String(fd.get("container_numbers") || "").split(/[,\n]+/).map(x => x.trim().toUpperCase()).filter(Boolean)
  };
}

async function saveDeal(e) {
  e.preventDefault();
  console.log("Saving deal...");
  try {
    const payload = ensureDocNumbers(validateDeal(new FormData(e.target)));
    console.log("Payload:", payload);
    const { data, error } = await supabase.from("deals").insert(payload).select();
    if (error) {
      console.error("SUPABASE ERROR:", error);
      throw error;
    }
    console.log("Save successful:", data);
    await loadSupabaseData();
  } catch (err) { 
    console.error("CATCH ERROR:", err);
    if (err.code === "23505") alert("Error: This Deal Number already exists. Please use a unique Deal No.");
    else alert("Error: " + err.message); 
  }
}

async function updateDeal(e, id) {
  e.preventDefault();
  try {
    const payload = validateDeal(new FormData(e.target));
    const { error } = await supabase.from("deals").update(payload).eq("id", id);
    if (error) throw error;
    await loadSupabaseData();
  } catch (err) { alert(err.message); }
}

async function deleteDeal(id) {
  if (confirm("Delete this deal?")) {
    const { error } = await supabase.from("deals").delete().eq("id", id);
    if (error) alert(error.message);
    else await loadSupabaseData();
  }
}

async function saveBuyer(e) {
  e.preventDefault();
  console.log("saveBuyer triggered");
  const fd = new FormData(e.target);
  console.log("Buyer Data:", Object.fromEntries(fd.entries()));
  const { data, error } = await supabase.from("buyers").insert({
    name: fd.get("name"), email: fd.get("email"), address: fd.get("address"), gst: fd.get("gst"), iec: fd.get("iec"), pan: fd.get("pan"),
    customer_id: normalizeCustomerId(fd.get("customer_id")), phone: fd.get("phone")
  }).select();
  
  if (error) {
    console.error("SUPABASE ERROR:", error);
    if (error.code === "23505") alert("Error: This Customer ID is already in use. Please use a different ID.");
    else alert(error.message);
    return;
  }

  console.log("Save successful:", data);
  await loadSupabaseData();
}

async function updateBuyer(e, id) {
  e.preventDefault();
  console.log("updateBuyer triggered for ID:", id);
  const fd = new FormData(e.target);
  const { data, error } = await supabase.from("buyers").update({
    name: fd.get("name"), email: fd.get("email"), address: fd.get("address"), gst: fd.get("gst"), iec: fd.get("iec"), pan: fd.get("pan"),
    customer_id: normalizeCustomerId(fd.get("customer_id")), phone: fd.get("phone")
  }).eq("id", id).select();
  
  if (error) {
    console.error("SUPABASE ERROR:", error);
    return alert(error.message);
  }
  console.log("Update successful:", data);
  await loadSupabaseData();
}

async function deleteBuyer(id) {
  if (confirm("Delete buyer?")) {
    const { error } = await supabase.from("buyers").delete().eq("id", id);
    if (error) alert(error.message);
    else await loadSupabaseData();
  }
}

// Supplier Actions
function showSupplierForm() {
  const wrap = document.getElementById("supplier-form-wrap");
  if (!wrap) return;
  wrap.innerHTML = supplierFormHtml();
  document.getElementById("supplier-form").addEventListener("submit", saveSupplier);
  document.getElementById("cancel-supplier-form").addEventListener("click", () => wrap.innerHTML = "");
}
function showEditSupplierForm(id) {
  const s = state.suppliers.find(x => String(x.id) === String(id));
  const wrap = document.getElementById(`supplier-edit-wrap-${id}`);
  if (!s || !wrap) return;
  wrap.innerHTML = supplierFormHtml(s, true, id);
  document.getElementById(`supplier-edit-form-${id}`).addEventListener("submit", (e) => updateSupplier(e, id));
  document.getElementById(`cancel-supplier-edit-${id}`).addEventListener("click", () => wrap.innerHTML = "");
}
async function saveSupplier(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const { error } = await supabase.from("suppliers").insert({
    name: fd.get("name"), company_name: fd.get("company_name"), country: fd.get("country"),
    email: fd.get("email"), address: fd.get("address"), bank_name: fd.get("bank_name"),
    bank_account: fd.get("bank_account"), bank_iban: fd.get("bank_iban"), bank_swift: fd.get("bank_swift")
  });
  if (error) return alert(error.message);
  await loadSupabaseData();
}
async function updateSupplier(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const { error } = await supabase.from("suppliers").update({
    name: fd.get("name"), company_name: fd.get("company_name"), country: fd.get("country"),
    email: fd.get("email"), address: fd.get("address"), bank_name: fd.get("bank_name"),
    bank_account: fd.get("bank_account"), bank_iban: fd.get("bank_iban"), bank_swift: fd.get("bank_swift")
  }).eq("id", id);
  if (error) return alert(error.message);
  await loadSupabaseData();
}
async function deleteSupplier(id) {
  if (confirm("Delete supplier?")) {
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) alert(error.message);
    else await loadSupabaseData();
  }
}

// Product Actions
async function saveProduct(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const { error } = await supabase.from("products").insert({
    name: fd.get("name"), hsn_code: fd.get("hsn_code")
  });
  if (error) return alert(error.message);
  await loadProducts();
  render();
}

function showEditProductForm(id) {
  const p = state.products.find(x => String(x.id) === String(id));
  const wrap = document.getElementById(`product-edit-wrap-${id}`);
  if (!p || !wrap) return;
  wrap.innerHTML = productEditFormHtml(p);
  document.getElementById(`product-edit-form-${id}`).addEventListener("submit", (e) => updateProduct(e, id));
  document.getElementById(`cancel-product-edit-${id}`).addEventListener("click", () => wrap.innerHTML = "");
}

async function updateProduct(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const { error } = await supabase.from("products").update({
    name: fd.get("name"), hsn_code: fd.get("hsn_code")
  }).eq("id", id);
  if (error) return alert(error.message);
  await loadProducts();
  render();
}

async function deleteProduct(id) {
  if (confirm("Delete product?")) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) alert(error.message);
    else {
      await loadProducts();
      render();
    }
  }
}

// Payment Actions
function showPaymentForm(dealId) {
  const wrap = document.getElementById(`payment-form-wrap-${dealId}`);
  if (!wrap) return;
  const deal = state.deals.find(d => String(d.id) === String(dealId));
  const dealCurrency = deal?.document_currency || deal?.currency || "AED";

  wrap.innerHTML = `
    <form id="payment-form-${dealId}" class="item">
      <div class="form-header">Add Payment (Deal Currency: ${dealCurrency})</div>
      <div class="grid gap-10">
        <select name="direction"><option value="in">Received (In)</option><option value="out">Sent (Out)</option></select>
        
        <div class="grid grid-2 gap-10">
          <input name="amount" id="p-amount-${dealId}" type="number" step="0.01" placeholder="Amount" required>
          <select name="currency" id="payment-currency-${dealId}">
            <option value="${dealCurrency}">${dealCurrency} (Deal Main)</option>
            <option value="AED" ${dealCurrency === "AED" ? "disabled" : ""}>AED</option>
            <option value="USD" ${dealCurrency === "USD" ? "disabled" : ""}>USD</option>
            <option value="INR">INR</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <input name="currency_other" id="payment-currency-other-${dealId}" placeholder="Specify other currency" style="display:none">
        
        <div id="conv-wrap-${dealId}" style="display:none; background:rgba(255,255,255,0.05); padding:10px; border-radius:4px">
          <div class="item-sub mb-8">Currency Conversion to ${dealCurrency}</div>
          <div class="grid grid-2 gap-10">
            <div>
              <label style="font-size:11px; opacity:0.7">Rate (1 ${dealCurrency} = ?)</label>
              <input name="conversion_rate" id="p-rate-${dealId}" type="number" step="0.000001" value="1">
            </div>
            <div>
              <label style="font-size:11px; opacity:0.7">Converted Amount</label>
              <input id="p-converted-${dealId}" type="text" readonly style="background:rgba(0,0,0,0.2)">
            </div>
          </div>
        </div>

        <select name="method" id="payment-method-${dealId}">
          <option value="Bank">Bank</option>
          <option value="Token">Token</option>
          <option value="Other">Other</option>
        </select>
        <input name="method_other" id="payment-method-other-${dealId}" placeholder="Specify other payment type" style="display:none">
        
        <input name="payment_date" type="date" value="${new Date().toISOString().split("T")[0]}" required>
        <input name="ref" placeholder="Reference / Note">
        
        <div class="flex gap-10">
          <button type="submit" class="btn-primary">Save Payment</button>
          <button type="button" onclick="this.closest('.item').remove()">Cancel</button>
        </div>
      </div>
    </form>
  `;

  const amountInput = document.getElementById(`p-amount-${dealId}`);
  const currSelect = document.getElementById(`payment-currency-${dealId}`);
  const currOther = document.getElementById(`payment-currency-other-${dealId}`);
  const convWrap = document.getElementById(`conv-wrap-${dealId}`);
  const rateInput = document.getElementById(`p-rate-${dealId}`);
  const convertedInput = document.getElementById(`p-converted-${dealId}`);

  const updateConv = () => {
    const isOther = currSelect.value !== dealCurrency;
    convWrap.style.display = isOther ? "block" : "none";
    
    const amount = Number(amountInput.value || 0);
    const rate = Number(rateInput.value || 1);
    // If user enters INR and deal is AED, and they say 1 AED = 22 INR, then Converted = amount / 22
    if (rate > 0) {
      convertedInput.value = (amount / rate).toFixed(2);
    }
  };

  currSelect.addEventListener("change", () => {
    currOther.style.display = currSelect.value === "Other" ? "block" : "none";
    currOther.required = currSelect.value === "Other";
    updateConv();
  });
  
  amountInput.addEventListener("input", updateConv);
  rateInput.addEventListener("input", updateConv);

  const methodSelect = document.getElementById(`payment-method-${dealId}`);
  const methodOther = document.getElementById(`payment-method-other-${dealId}`);
  methodSelect.addEventListener("change", () => {
    methodOther.style.display = methodSelect.value === "Other" ? "block" : "none";
    methodOther.required = methodSelect.value === "Other";
  });

  document.getElementById(`payment-form-${dealId}`).addEventListener("submit", (e) => savePayment(e, dealId));
}

async function savePayment(e, dealId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const deal = state.deals.find(d => String(d.id) === String(dealId));
  const dealCurrency = deal?.document_currency || deal?.currency || "AED";
  
  let method = fd.get("method");
  if (method === "Other") method = fd.get("method_other");

  let currency = fd.get("currency");
  if (currency === "Other") currency = fd.get("currency_other");

  const amount = Number(fd.get("amount"));
  const rate = Number(fd.get("conversion_rate") || 1);
  const convertedAmount = currency === dealCurrency ? amount : amount / rate;

  const { error } = await supabase.from("payments").insert({
    deal_id: dealId,
    amount: amount,
    direction: fd.get("direction"),
    payment_date: fd.get("payment_date"),
    method: method,
    currency: currency,
    conversion_rate: rate,
    converted_amount: convertedAmount,
    ref: fd.get("ref"),
    status: "completed"
  });

  if (error) alert(error.message);
  else {
    await loadSupabaseData();
    render();
  }
}

function showDocumentForm(dealId) {
  const wrap = document.getElementById(`document-form-wrap-${dealId}`);
  if (!wrap) return;
  wrap.innerHTML = `
    <form data-placeholder-upload="${dealId}" class="item">
      <div class="form-header">Upload Document</div>
      <div class="grid gap-10">
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
        <input type="file" name="file" required>
        <div class="flex gap-10">
          <button type="submit" class="btn-primary">Upload Document</button>
          <button type="button" onclick="this.closest('.item').remove()">Cancel</button>
        </div>
      </div>
    </form>
  `;
  wrap.querySelector("form").addEventListener("submit", saveDealDocument);
}



async function deletePayment(val) {
  const parts = val.split(":");
  const paymentId = parts.length > 1 ? parts[1] : parts[0];
  
  if (confirm("Delete payment?")) {
    const { error } = await supabase.from("payments").delete().eq("id", paymentId);
    if (error) alert(error.message);
    else {
      await loadSupabaseData();
      render();
    }
  }
}

async function showEditPaymentForm(val) {
  const [dealId, paymentId] = val.split(":");
  const wrap = document.getElementById(`payment-edit-wrap-${paymentId}`);
  if (!wrap) return;
  
  const deal = state.deals.find(d => String(d.id) === String(dealId));
  const p = (state.paymentsByDeal[dealId] || []).find(x => String(x.id) === String(paymentId));
  if (!p || !deal) return;
  
  const dealCurrency = deal.document_currency || deal.currency || "AED";

  wrap.innerHTML = `
    <form id="payment-edit-form-${paymentId}" class="item" style="background:rgba(255,255,255,0.05); padding:10px; border-radius:4px">
      <div class="form-header">Edit Payment</div>
      <div class="grid gap-10">
        <select name="direction">
          <option value="in" ${p.direction === "in" ? "selected" : ""}>Received (In)</option>
          <option value="out" ${p.direction === "out" ? "selected" : ""}>Sent (Out)</option>
        </select>
        
        <div class="grid grid-2 gap-10">
          <input name="amount" id="pe-amount-${paymentId}" type="number" step="0.01" value="${p.amount}" required>
          <select name="currency" id="pe-currency-${paymentId}">
            <option value="AED" ${p.currency === "AED" ? "selected" : ""}>AED</option>
            <option value="USD" ${p.currency === "USD" ? "selected" : ""}>USD</option>
            <option value="INR" ${p.currency === "INR" ? "selected" : ""}>INR</option>
            <option value="Other" ${!["AED","USD","INR"].includes(p.currency) ? "selected" : ""}>Other</option>
          </select>
        </div>
        <input name="currency_other" id="pe-currency-other-${paymentId}" value="${!["AED","USD","INR"].includes(p.currency) ? p.currency : ""}" placeholder="Specify currency" style="display:${!["AED","USD","INR"].includes(p.currency) ? "block" : "none"}">
        
        <div id="pe-conv-wrap-${paymentId}" style="display:${p.currency !== dealCurrency ? "block" : "none"}; background:rgba(0,0,0,0.1); padding:10px; border-radius:4px">
          <div class="item-sub mb-8">Conversion to ${dealCurrency}</div>
          <div class="grid grid-2 gap-10">
            <div>
              <label style="font-size:11px; opacity:0.7">Rate</label>
              <input name="conversion_rate" id="pe-rate-${paymentId}" type="number" step="0.000001" value="${p.conversion_rate || 1}">
            </div>
            <div>
              <label style="font-size:11px; opacity:0.7">Converted</label>
              <input id="pe-converted-${paymentId}" type="text" readonly value="${(p.converted_amount || p.amount).toFixed(2)}" style="background:transparent; border:none">
            </div>
          </div>
        </div>

        <select name="method" id="pe-method-${paymentId}">
          <option value="Bank" ${p.method === "Bank" ? "selected" : ""}>Bank</option>
          <option value="Token" ${p.method === "Token" ? "selected" : ""}>Token</option>
          <option value="Other" ${!["Bank","Token"].includes(p.method) ? "selected" : ""}>Other</option>
        </select>
        <input name="method_other" id="pe-method-other-${paymentId}" value="${!["Bank","Token"].includes(p.method) ? p.method : ""}" placeholder="Specify method" style="display:${!["Bank","Token"].includes(p.method) ? "block" : "none"}">
        
        <input name="payment_date" type="date" value="${p.payment_date}" required>
        <input name="ref" value="${esc(p.ref || "")}" placeholder="Reference">
        
        <div class="flex gap-10">
          <button type="submit" class="btn-primary btn-small">Update</button>
          <button type="button" class="btn-small" onclick="this.closest('form').remove()">Cancel</button>
        </div>
      </div>
    </form>
  `;

  const form = document.getElementById(`payment-edit-form-${paymentId}`);
  const amountIn = form.querySelector("[name='amount']");
  const currIn = form.querySelector("[name='currency']");
  const rateIn = form.querySelector("[name='conversion_rate']");
  const convOut = document.getElementById(`pe-converted-${paymentId}`);
  
  const update = () => {
    const isConv = currIn.value !== dealCurrency;
    document.getElementById(`pe-conv-wrap-${paymentId}`).style.display = isConv ? "block" : "none";
    const amount = Number(amountIn.value || 0);
    const rate = Number(rateIn.value || 1);
    if (rate > 0) convOut.value = (amount / rate).toFixed(2);
  };

  currIn.addEventListener("change", () => {
    const other = document.getElementById(`pe-currency-other-${paymentId}`);
    other.style.display = currIn.value === "Other" ? "block" : "none";
    update();
  });
  amountIn.addEventListener("input", update);
  rateIn.addEventListener("input", update);
  form.querySelector("[name='method']").addEventListener("change", (e) => {
    form.querySelector("[name='method_other']").style.display = e.target.value === "Other" ? "block" : "none";
  });

  form.addEventListener("submit", (e) => updatePayment(e, dealId, paymentId));
}

async function updatePayment(e, dealId, paymentId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const deal = state.deals.find(d => String(d.id) === String(dealId));
  const dealCurrency = deal?.document_currency || deal?.currency || "AED";

  let method = fd.get("method");
  if (method === "Other") method = fd.get("method_other");

  let currency = fd.get("currency");
  if (currency === "Other") currency = fd.get("currency_other");

  const amount = Number(fd.get("amount"));
  const rate = Number(fd.get("conversion_rate") || 1);
  const convertedAmount = currency === dealCurrency ? amount : Math.round((amount / rate + Number.EPSILON) * 100) / 100;

  const { error } = await supabase.from("payments").update({
    amount: amount,
    direction: fd.get("direction"),
    payment_date: fd.get("payment_date"),
    method: method,
    currency: currency,
    conversion_rate: rate,
    converted_amount: convertedAmount,
    ref: fd.get("ref")
  }).eq("id", paymentId);

  if (error) alert(error.message);
  else {
    await loadSupabaseData();
    render();
  }
}

/**
 * FORM HELPERS
 */
function showBuyerForm() {
  console.log("showBuyerForm called");
  const wrap = document.getElementById("buyer-form-wrap");
  if (!wrap) return console.warn("buyer-form-wrap not found");
  wrap.innerHTML = buyerFormHtml();
  document.getElementById("buyer-form").addEventListener("submit", saveBuyer);
  document.getElementById("cancel-buyer-form").addEventListener("click", () => wrap.innerHTML = "");
}
function showEditBuyerForm(id) {
  console.log("showEditBuyerForm called for ID:", id);
  const b = state.buyers.find(x => String(x.id) === String(id));
  const wrap = document.getElementById(`buyer-edit-wrap-${id}`);
  if (!b || !wrap) return console.warn("Edit wrap or buyer not found", id);
  wrap.innerHTML = buyerFormHtml(b, true, id);
  document.getElementById(`buyer-edit-form-${id}`).addEventListener("submit", (e) => updateBuyer(e, id));
  document.getElementById(`cancel-buyer-edit-${id}`).addEventListener("click", () => wrap.innerHTML = "");
}
function showDealForm() {
  const wrap = document.getElementById("deal-form-wrap");
  if (!wrap) return;
  wrap.innerHTML = dealFormHtml({}, false);
  document.getElementById("deal-form").addEventListener("submit", saveDeal);
  document.getElementById("cancel-deal-form").addEventListener("click", () => wrap.innerHTML = "");
  bindDealAutoTotal();
  bindProductHsnLookup();
}
function showEditDealForm(id) {
  const d = state.deals.find(x => String(x.id) === String(id));
  const wrap = document.getElementById(`deal-edit-wrap-${id}`);
  if (!d || !wrap) return;
  wrap.innerHTML = dealFormHtml(d, true, id);
  document.getElementById(`deal-edit-form-${id}`).addEventListener("submit", (e) => updateDeal(e, id));
  document.getElementById(`cancel-deal-edit-${id}`).addEventListener("click", () => wrap.innerHTML = "");
  bindDealAutoTotal(id);
  bindProductHsnLookup(id);
}

function bindDealAutoTotal(id = null) {
  const suffix = id ? `-${id}` : "";
  const qtyIn = document.getElementById(`quantity${suffix}`);
  const rateIn = document.getElementById(`rate${suffix}`);
  const pRateIn = document.getElementById(`purchase-rate${suffix}`);
  const convIn = document.getElementById(`conversion-rate${suffix}`);
  const baseCurrIn = document.getElementById(`base-currency${suffix}`);
  const netIn = document.getElementById(`net-weight${suffix}`);
  const grossIn = document.getElementById(`gross-weight${suffix}`);
  
  const totalUsdIn = document.getElementById(`total${suffix}`);
  const totalAedIn = document.getElementById(`total-aed${suffix}`);
  const pTotalUsdIn = document.getElementById(`purchase-total${suffix}`);
  const pTotalAedIn = document.getElementById(`purchase-total-aed${suffix}`);

  const updateQtyFromWeight = (e) => {
    const kg = Number(e.target.value || 0);
    if (kg > 0 && qtyIn) {
      qtyIn.value = (kg / 1000).toFixed(2);
      calc(); 
    }
  };

  netIn?.addEventListener("input", updateQtyFromWeight);
  grossIn?.addEventListener("input", updateQtyFromWeight);

  const calc = () => {
    const q = Number(qtyIn?.value || 0);
    const r = Number(rateIn?.value || 0);
    const pr = Number(pRateIn?.value || 0);
    const c = Number(convIn?.value || 0);
    const bc = baseCurrIn?.value || "USD";

    const round = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    // Sale Totals
    let sUsd = 0, sAed = 0;
    if (bc === "USD") {
      sUsd = q * r;
      sAed = c ? sUsd * c : 0;
    } else {
      sAed = q * r;
      sUsd = c ? sAed / c : 0;
    }
    sUsd = round(sUsd);
    sAed = round(sAed);

    // Purchase Totals
    let pUsd = 0, pAed = 0;
    if (bc === "USD") {
      pUsd = q * pr;
      pAed = c ? pUsd * c : 0;
    } else {
      pAed = q * pr;
      pUsd = c ? pAed / c : 0;
    }
    pUsd = round(pUsd);
    pAed = round(pAed);

    if (totalUsdIn) totalUsdIn.value = sUsd.toFixed(2);
    if (totalAedIn) totalAedIn.value = sAed.toFixed(2);
    if (pTotalUsdIn) pTotalUsdIn.value = pUsd.toFixed(2);
    if (pTotalAedIn) pTotalAedIn.value = pAed.toFixed(2);
  };

  [qtyIn, rateIn, pRateIn, convIn, baseCurrIn].forEach(el => el?.addEventListener("input", calc));
  [qtyIn, rateIn, pRateIn, convIn, baseCurrIn].forEach(el => el?.addEventListener("change", calc));
}

// Misc
function loginView() { return `<div class="card" style="max-width:400px;margin:100px auto"><div class="title mb-12">Login</div><form id="login-form"><input name="email" type="email" placeholder="Email" required class="mb-10"><input name="password" type="password" placeholder="Password" required class="mb-10"><button type="submit" class="btn-primary">Login</button></form></div>`; }
// Settings Actions
async function saveCompanySettings(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  
  const bankAccounts = [];
  document.querySelectorAll("[data-bank-index]").forEach(input => {
    const idx = input.dataset.bankIndex;
    if (!bankAccounts[idx]) bankAccounts[idx] = {};
    bankAccounts[idx][input.dataset.bankField] = input.value;
  });

  const shippers = [];
  document.querySelectorAll("[data-shipper-index]").forEach(input => {
    const idx = input.dataset.shipperIndex;
    if (!shippers[idx]) shippers[idx] = {};
    shippers[idx][input.dataset.shipperField] = input.value;
  });

  const payload = {
    name: fd.get("name"),
    address: fd.get("address"),
    bank_accounts: bankAccounts.filter(Boolean),
    shippers: shippers.filter(Boolean),
    gemini_api_key: fd.get("gemini_api_key"),
    gemini_model: fd.get("gemini_model")
  };

  let { error } = await supabase.from("company_settings").update(payload).eq("id", 1);
  
  if (error && error.message.includes("gemini_model")) {
    console.warn("gemini_model column missing, saving to localStorage instead.");
    localStorage.setItem("gemini_model", payload.gemini_model);
    delete payload.gemini_model;
    const retry = await supabase.from("company_settings").update(payload).eq("id", 1);
    error = retry.error;
  } else if (!error) {
    localStorage.setItem("gemini_model", payload.gemini_model);
  }

  if (error) alert(error.message);
  else {
    alert("Settings saved!");
    await loadSupabaseData();
  }
}

function addBankAccount() {
  state.company.bankAccounts.push({ bankName: "", account: "", iban: "", swift: "" });
  render();
}
function deleteBankAccount(idx) {
  state.company.bankAccounts.splice(idx, 1);
  render();
}
function addShipper() {
  state.company.shippers.push({ name: "", mobile: "", address: "", email: "" });
  render();
}
function deleteShipper(idx) {
  state.company.shippers.splice(idx, 1);
  render();
}

// Shipping Instruction Actions
function bindShippingInstructionForm() {
  const form = document.getElementById("shipping-instruction-form");
  if (!form) return;
  form.addEventListener("submit", saveShippingInstruction);
  document.getElementById("download-shipping-instruction")?.addEventListener("click", downloadShippingInstruction);
  document.getElementById("whatsapp-shipping-instruction")?.addEventListener("click", whatsappShippingInstruction);
  
  document.getElementById("si-product")?.addEventListener("change", (e) => {
    const hsn = e.target.selectedOptions[0]?.dataset.hsn || "";
    document.getElementById("si-hsn").value = hsn;
  });
}

async function saveShippingInstruction(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const getVal = (k) => {
    const v = fd.get(k);
    return v && v.trim() !== "" ? parseInt(v, 10) : null;
  };

  const { error } = await supabase.from("shipping_instructions").insert({
    shipper_index: getVal("shipper_index"),
    buyer_id: getVal("buyer_id"),
    deal_id: getVal("deal_id"),
    supplier_id: getVal("supplier_id"),
    product: fd.get("product"),
    hsn_code: fd.get("hsn_code"),
    free_days_text: fd.get("free_days_text"),
    detention_text: fd.get("detention_text"),
    other_instructions: fd.get("other_instructions")
  });
  if (error) alert(error.message);
  else {
    alert("Saved!");
    await loadSupabaseData();
  }
}

async function deleteShippingInstruction(id) {
  if (confirm("Delete shipping instruction?")) {
    const { error } = await supabase.from("shipping_instructions").delete().eq("id", id);
    if (error) alert(error.message);
    else await loadSupabaseData();
  }
}

function whatsappShippingInstruction() {
  const fd = new FormData(document.getElementById("shipping-instruction-form"));
  const shipperIdx = fd.get("shipper_index");
  const shipper = state.company.shippers?.[shipperIdx] || state.company;
  const b = getBuyerById(fd.get("buyer_id"));
  const supplier = state.suppliers.find(s => String(s.id) === String(fd.get("supplier_id")))?.name || "—";
  const deal = getDealById(fd.get("deal_id"))?.deal_no || "—";

  const text = `*SHIPPING INSTRUCTIONS*
  
*SHIPPER DETAILS:*
${shipper.name || "—"}
${shipper.address || "—"}
Mobile: ${shipper.mobile || "—"}
Email: ${shipper.email || "—"}

*CONSIGNEE DETAILS:*
${b?.name || "—"}
${b?.address || "—"}
GST: ${b?.gst || "—"}
IEC: ${b?.iec || "—"}

*Product:* ${fd.get("product")}
*HSN:* ${fd.get("hsn_code")}

${fd.get("free_days_text")}
${fd.get("detention_text")}

*Other Instructions:*
${fd.get("other_instructions")}

Generated via JK Trade Manager`;

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

function downloadShippingInstruction() {
  const fd = new FormData(document.getElementById("shipping-instruction-form"));
  const shipperIdx = fd.get("shipper_index");
  const shipper = state.company.shippers?.[shipperIdx] || state.company;
  const b = getBuyerById(fd.get("buyer_id"));
  const supplier = state.suppliers.find(s => String(s.id) === String(fd.get("supplier_id")))?.name || "—";
  const deal = getDealById(fd.get("deal_id"))?.deal_no || "—";

  const text = `SHIPPING INSTRUCTIONS

SHIPPER DETAILS:
${shipper.name || "—"}
${shipper.address || "—"}
Mobile: ${shipper.mobile || "—"}
Email: ${shipper.email || "—"}

CONSIGNEE DETAILS:
${b?.name || "—"}
${b?.address || "—"}
GST: ${b?.gst || "—"}
IEC: ${b?.iec || "—"}

Product: ${fd.get("product")}
HSN: ${fd.get("hsn_code")}

${fd.get("free_days_text")}
${fd.get("detention_text")}

Other Instructions:
${fd.get("other_instructions")}

-------------------------------
Generated via JK Trade Manager`;

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shipping-instruction-${deal}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// Document Actions
async function saveDealDocument(e) {
  e.preventDefault();
  const dealId = e.target.getAttribute("data-placeholder-upload");
  const fd = new FormData(e.target);
  const file = fd.get("file");
  const docType = fd.get("docType");
  
  if (!file || file.size === 0) {
    return alert("Please select a file to upload.");
  }
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
  const filePath = `${dealId}/${fileName}`;
  
  e.target.querySelector("button").textContent = "Uploading...";
  e.target.querySelector("button").disabled = true;

  try {
    const { data: uploadData, error: uploadError } = await supabase.storage.from("deal-documents").upload(filePath, file);
    if (uploadError) throw uploadError;
    
    const { data: publicUrlData } = supabase.storage.from("deal-documents").getPublicUrl(filePath);
    
    const { error } = await supabase.from("deal_documents").insert({
      deal_id: dealId,
      doc_type: docType,
      file_name: file.name,
      file_url: publicUrlData.publicUrl,
      file_path: filePath,
      mime_type: file.type || "application/octet-stream",
      is_deleted: false
    });
    
    if (error) throw error;
    await loadSupabaseData();
    render();
  } catch (err) {
    if (err.message && err.message.includes("Bucket not found")) {
      const { data: buckets } = await supabase.storage.listBuckets();
      const names = buckets && buckets.length ? buckets.map(b => b.name).join(", ") : "No buckets found";
      alert("Upload failed: Bucket not found.\n\nThe code is looking for 'deal_documents', but your Supabase only has these buckets:\n" + names + "\n\nPlease rename your bucket to 'deal_documents' or create it exactly like that.");
    } else {
      alert("Upload failed: " + err.message);
    }
    e.target.querySelector("button").textContent = "Upload Document";
    e.target.querySelector("button").disabled = false;
  }
}

async function deleteDealDocument(val) {
  const parts = val.split(":");
  const docId = parts.length > 1 ? parts[1] : parts[0];
  
  if (confirm("Delete document?")) {
    const { error } = await supabase.from("deal_documents").update({ is_deleted: true }).eq("id", docId);
    if (error) alert(error.message);
    else {
      await loadSupabaseData();
      render();
    }
  }
}

async function showEditDocumentForm(val) {
  const [dealId, docId] = val.split(":");
  const wrap = document.getElementById(`document-edit-wrap-${docId}`);
  if (!wrap) return;
  
  const docs = state.documentsByDeal[dealId] || [];
  const doc = docs.find(d => String(d.id) === String(docId));
  if (!doc) return;

  wrap.innerHTML = `
    <form id="doc-edit-form-${docId}" class="grid gap-10 mt-8 p-10" style="background:rgba(255,255,255,0.05); border-radius:4px">
      <div class="form-header" style="font-size:13px">Replace Document</div>
      <select name="docType">
        <option value="BL" ${doc.doc_type === "BL" ? "selected" : ""}>BL</option>
        <option value="OBL" ${doc.doc_type === "OBL" ? "selected" : ""}>OBL</option>
        <option value="Telex" ${doc.doc_type === "Telex" ? "selected" : ""}>Telex</option>
        <option value="Supplier Invoice" ${doc.doc_type === "Supplier Invoice" ? "selected" : ""}>Supplier Invoice</option>
        <option value="Commercial Invoice" ${doc.doc_type === "Commercial Invoice" ? "selected" : ""}>Commercial Invoice</option>
        <option value="Packing List" ${doc.doc_type === "Packing List" ? "selected" : ""}>Packing List</option>
        <option value="Certificate" ${doc.doc_type === "Certificate" ? "selected" : ""}>Certificate</option>
        <option value="Other" ${doc.doc_type === "Other" ? "selected" : ""}>Other</option>
      </select>
      <input type="file" name="file">
      <div class="item-sub" style="font-size:11px; margin-top:-5px">Leave file empty to only change the type.</div>
      <div class="flex gap-10">
        <button type="submit" class="btn-primary btn-small">Update</button>
        <button type="button" class="btn-small" onclick="this.closest('form').remove()">Cancel</button>
      </div>
    </form>
  `;

  wrap.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const file = fd.get("file");
    const docType = fd.get("docType");
    const btn = e.target.querySelector("button[type='submit']");
    
    btn.textContent = "Updating...";
    btn.disabled = true;

    try {
      let updateData = { doc_type: docType };

      if (file && file.size > 0) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${dealId}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage.from("deal-documents").upload(filePath, file);
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage.from("deal-documents").getPublicUrl(filePath);
        
        updateData.file_name = file.name;
        updateData.file_url = publicUrlData.publicUrl;
        updateData.file_path = filePath;
        updateData.mime_type = file.type || "application/octet-stream";
      }

      const { error } = await supabase.from("deal_documents").update(updateData).eq("id", docId);
      if (error) throw error;
      
      await loadSupabaseData();
      render();
    } catch (err) {
      alert("Update failed: " + err.message);
      btn.textContent = "Update";
      btn.disabled = false;
    }
  });
}

// Export Actions
function exportDealsCsv() {
  const headers = [
    "Deal No", "Type", "Status", "Approval", 
    "Supplier", "Purchase Rate", "Purchase Total USD", "Purchase Total AED", "Sent (Supplier)", "Payable (Supplier Bal)",
    "Buyer", "Sale Rate", "Sale Total USD", "Sale Total AED", "Received (Buyer)", "Receivable (Buyer Bal)",
    "Product", "HSN", "Quantity", "Unit", 
    "Base Currency", "Doc Currency", "Conv Rate", 
    "Loading Port", "Discharge Port", "Vessel", "ETA", "Shipment Out", "Payment Terms"
  ];

  const rows = state.deals.map(d => {
    const buyer = getBuyerById(d.buyer_id)?.name || "—";
    const supplier = state.suppliers.find(s => String(s.id) === String(d.supplier_id))?.name || "—";
    
    const isUsd = d.document_currency === "USD";
    const s = paymentSummary(
      d.id, 
      isUsd ? d.total_amount_usd : d.total_amount_aed,
      isUsd ? d.purchase_total_usd : d.purchase_total_aed
    );
    
    const data = [
      d.deal_no, d.type, d.status, d.approval_status,
      supplier, d.purchase_rate, d.purchase_total_usd, d.purchase_total_aed, s.sent, s.payable,
      buyer, d.rate, d.total_amount_usd, d.total_amount_aed, s.received, s.receivable,
      d.product_name, d.hsn_code, d.quantity, d.unit,
      d.base_currency, d.document_currency, d.conversion_rate,
      d.loading_port, d.discharge_port, d.vessel_voyage || d.vessel, d.eta, d.shipment_out_date, d.payment_terms
    ];

    return data.map(val => `"${String(val ?? "").replace(/"/g, '""')}"`).join(",");
  });

  const csv = headers.join(",") + "\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `deals_export_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function bindProductHsnLookup(id = null) {
  const suffix = id ? `-${id}` : "";
  const select = document.getElementById(`product-name${suffix}`);
  if (!select) return;

  select.addEventListener("change", (e) => {
    const hsn = e.target.selectedOptions[0]?.dataset.hsn || "";
    const hsnInput = document.getElementById(`hsn-code${suffix}`);
    if (hsnInput) hsnInput.value = hsn;
  });
}

function printDoc(type, dealId) {
  const deal = getDealById(dealId);
  const buyer = getBuyerById(deal?.buyer_id);
  const supplier = state.suppliers.find(s => String(s.id) === String(deal?.supplier_id));
  const dealDoc = { ...deal, dealNo: deal.deal_no, productName: deal.product_name, totalAmount: deal.total_amount };
  const payments = paymentsForDeal(dealId);
  let html = "";
  if (type === "pi") html = buildPI(dealDoc, buyer, supplier, state.company);
  if (type === "ci") html = buildCI(dealDoc, buyer, supplier, state.company);
  if (type === "pl") html = buildPL(dealDoc, buyer, supplier, state.company);
  if (type === "coo") html = buildCOO(dealDoc, buyer, supplier, state.company);
  if (type === "supplier-statement") html = buildSupplierStatement(deal, buyer, supplier, payments, state.company);
  if (type === "buyer-statement") html = buildBuyerStatement(deal, buyer, supplier, payments, state.company);
  if (html) openPrintWindow(html);
}

async function runAiScan(dealId, docId) {
  const key = state.company.gemini_api_key;
  if (!key) return alert("Please add your Gemini API Key in Settings first.");

  const doc = state.documentsByDeal[dealId]?.find(d => String(d.id) === String(docId));
  if (!doc || !doc.file_url) return alert("Document file not found.");

  const btn = document.querySelector(`[data-ai-scan="${dealId}:${docId}"]`);
  const originalText = btn.textContent;
  btn.textContent = "Scanning...";
  btn.disabled = true;

  try {
    // 1. Get file as base64
    const response = await fetch(doc.file_url);
    const blob = await response.blob();
    const reader = new FileReader();
    const base64 = await new Promise((resolve) => {
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });

    // 2. Call Gemini API
    const model = state.company.gemini_model || "gemini-2.5-flash";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const prompt = `Analyze this Bill of Lading and extract the following details. Be very thorough as these fields are critical:
    - bl_no: The Bill of Lading number.
    - vessel: The name of the vessel.
    - voyage_no: The voyage number (often listed next to or below the vessel name).
    - loading_port: Port of loading.
    - discharge_port: Port of discharge.
    - product_name: Description of goods/product.
    - quantity: Total quantity/weight of the main product (number only).
    - gross_weight: Total Gross Weight (number only).
    - net_weight: Total Net Weight (number only).
    - container_numbers: A list/array of all container numbers mentioned (e.g. ["MSCU1234567", "MSCU7654321"]). Look in the 'Container No.' or 'Marks & Nos' section.
    - shipment_out_date: Date of shipment or 'Shipped on Board' date (YYYY-MM-DD).
    - eta: Estimated time of arrival if mentioned (YYYY-MM-DD).
    
    Return the data in strict JSON format. If a field is missing, use null. Only return the JSON object.`;
    
    const aiRes = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: doc.mime_type || "image/jpeg", data: base64 } }
          ]
        }]
      })
    });

    const result = await aiRes.json();
    if (!aiRes.ok) {
      console.error("Gemini API Error Response:", result);
      throw new Error(result.error?.message || "Unknown API Error");
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("Gemini Response Object:", result);
      throw new Error("AI could not read the document. The response was empty.");
    }

    // Clean JSON from markdown if present
    const jsonStr = text.replace(/```json|```/g, "").trim();
    const data = JSON.parse(jsonStr);

    // 3. Confirm and Update
    const rawContainers = Array.isArray(data.container_numbers) ? data.container_numbers : [];
    const cleanContainers = rawContainers.map(c => String(c).replace(/[^A-Z0-9]/gi, "").toUpperCase());
    const containerCount = cleanContainers.length;
    
    const summary = [
      `BL No: ${data.bl_no || "—"}`,
      `Vessel/Voyage: ${data.vessel || "—"}${data.voyage_no ? ` / ${data.voyage_no}` : ""}`,
      `Port: ${data.loading_port || "—"} -> ${data.discharge_port || "—"}`,
      `Product: ${data.product_name || "—"}`,
      `Qty: ${data.quantity || "—"}`,
      `Weights: G:${data.gross_weight || "—"} / N:${data.net_weight || "—"}`,
      `Containers (${containerCount}): ${containerCount > 0 ? cleanContainers.slice(0, 3).join(", ") + (containerCount > 3 ? "..." : "") : "None found"}`
    ].join("\n");

    if (confirm(`AI found the following details:\n\n${summary}\n\nApply these changes to the deal?`)) {
      const updateData = {};
      if (data.bl_no) updateData.bl_no = String(data.bl_no).replace(/[^A-Z0-9\-\/]/gi, "").toUpperCase();
      if (data.vessel) updateData.vessel = String(data.vessel).trim().toUpperCase();
      if (data.vessel || data.voyage_no) {
        const v = String(data.vessel || "").trim().toUpperCase();
        const voy = String(data.voyage_no || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
        updateData.vessel_voyage = [v, voy].filter(Boolean).join(" / ");
      }
      if (data.loading_port) updateData.loading_port = String(data.loading_port).trim().toUpperCase();
      if (data.discharge_port) updateData.discharge_port = String(data.discharge_port).trim().toUpperCase();
      if (data.product_name) updateData.product_name = String(data.product_name).trim().toUpperCase();
      if (data.quantity) updateData.quantity = data.quantity;
      if (data.gross_weight) updateData.gross_weight = Number(data.gross_weight);
      if (data.net_weight) updateData.net_weight = Number(data.net_weight);
      if (data.container_numbers) {
        updateData.container_numbers = data.container_numbers.map(c => 
          String(c).replace(/[^A-Z0-9]/gi, "").toUpperCase()
        );
      }
      if (data.shipment_out_date) updateData.shipment_out_date = data.shipment_out_date;
      if (data.eta) updateData.eta = data.eta;

      const { error } = await supabase.from("deals").update(updateData).eq("id", dealId);
      if (error) throw error;
      
      alert("Deal updated successfully!");
      await loadSupabaseData();
      render();
    }
  } catch (err) {
    console.error("AI Scan Error:", err);
    alert("Scan failed: " + err.message);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function checkAiConnection() {
  const key = state.company.gemini_api_key;
  if (!key) return alert("Please enter an API Key first.");

  const btn = document.getElementById("check-ai-btn");
  btn.textContent = "Checking...";
  
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.error?.message || "Connection failed");
    
    const modelNames = data.models?.map(m => m.name.replace("models/", "")) || [];
    alert(`Success! Your key can access these models:\n\n${modelNames.join("\n")}\n\nPlease tell Antigravity which ones you see!`);
  } catch (err) {
    alert("Connection failed: " + err.message);
  } finally {
    btn.textContent = "Check AI Connection";
  }
}

// Start
loadSession();