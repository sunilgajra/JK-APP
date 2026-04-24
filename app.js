import { openPrintWindow, buildPI, buildCI, buildPL, buildCOO, buildShippingInstruction } from "./documents.js";
import { supabase } from "./supabase.js";
import { state, buyerName, supplierName, getBuyerById, getDealById, getShipperOptions, paymentsForDeal } from "./state.js";
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
    (documentsRes.data || []).forEach(doc => {
      const k = String(doc.deal_id);
      if (!groupedDocs[k]) groupedDocs[k] = [];
      groupedDocs[k].push(doc);
    });
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

  // Payments and Docs
  document.querySelectorAll("[data-show-payment-form]").forEach(btn => btn.addEventListener("click", () => showPaymentForm(btn.dataset.showPaymentForm)));
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
  const rate = cleanNumber(fd.get("rate"));
  const conv = cleanNumber(fd.get("conversion_rate"));
  const baseCurr = fd.get("base_currency") || "USD";
  const docCurr = fd.get("document_currency") || baseCurr;

  let rateUsd = 0, rateAed = 0, totalUsd = 0, totalAed = 0;

  if (baseCurr === "USD") {
    rateUsd = rate;
    rateAed = conv ? rate * conv : 0;
  } else {
    rateAed = rate;
    rateUsd = conv ? rate / conv : 0;
  }

  totalUsd = quantity * rateUsd;
  totalAed = quantity * rateAed;

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
    rate,
    rate_usd: rateUsd,
    rate_aed: rateAed,
    total_amount: docCurr === "USD" ? totalUsd : totalAed,
    total_amount_usd: totalUsd,
    total_amount_aed: totalAed,
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
  wrap.innerHTML = `
    <form id="payment-form-${dealId}" class="item">
      <div class="form-header">Add Payment</div>
      <div class="grid gap-10">
        <select name="direction"><option value="in">Received (In)</option><option value="out">Sent (Out)</option></select>
        <input name="amount" type="number" step="0.01" placeholder="Amount" required>
        <input name="payment_date" type="date" value="${new Date().toISOString().split("T")[0]}" required>
        <input name="ref" placeholder="Reference / Note">
        <div class="flex gap-10">
          <button type="submit" class="btn-primary">Save Payment</button>
          <button type="button" onclick="this.closest('.item').remove()">Cancel</button>
        </div>
      </div>
    </form>
  `;
  document.getElementById(`payment-form-${dealId}`).addEventListener("submit", (e) => savePayment(e, dealId));
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

async function savePayment(e, dealId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const { error } = await supabase.from("payments").insert({
    deal_id: dealId,
    direction: fd.get("direction"),
    amount: Number(fd.get("amount")),
    payment_date: fd.get("payment_date"),
    ref: fd.get("ref"),
    currency: "AED" // Defaulting for now
  });
  if (error) return alert(error.message);
  await loadSupabaseData();
}

async function deletePayment(dealId, paymentId) {
  if (confirm("Delete payment?")) {
    const { error } = await supabase.from("payments").delete().eq("id", paymentId);
    if (error) alert(error.message);
    else await loadSupabaseData();
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
  const convIn = document.getElementById(`conversion-rate${suffix}`);
  const baseCurrIn = document.getElementById(`base-currency${suffix}`);
  const totalUsdIn = document.getElementById(`total${suffix}`);
  const totalAedIn = document.getElementById(`total-aed${suffix}`);

  const calc = () => {
    const q = Number(qtyIn?.value || 0);
    const r = Number(rateIn?.value || 0);
    const c = Number(convIn?.value || 0);
    const bc = baseCurrIn?.value || "USD";

    let tUsd = 0, tAed = 0;
    if (bc === "USD") {
      tUsd = q * r;
      tAed = c ? tUsd * c : 0;
    } else {
      tAed = q * r;
      tUsd = c ? tAed / c : 0;
    }

    if (totalUsdIn) totalUsdIn.value = tUsd.toFixed(2);
    if (totalAedIn) totalAedIn.value = tAed.toFixed(2);
  };

  [qtyIn, rateIn, convIn, baseCurrIn].forEach(el => el?.addEventListener("input", calc));
  [qtyIn, rateIn, convIn, baseCurrIn].forEach(el => el?.addEventListener("change", calc));
}

// Misc
function loginView() { return `<div class="card" style="max-width:400px;margin:100px auto"><div class="title mb-12">Login</div><form id="login-form"><input name="email" type="email" placeholder="Email" required class="mb-10"><input name="password" type="password" placeholder="Password" required class="mb-10"><button type="submit" class="btn-primary">Login</button></form></div>`; }
// Settings Actions
async function saveCompanySettings(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  
  const bankAccounts = [];
  document.querySelectorAll("[data-bank-index]").forEach(input => {
    const idx = input.dataset.bank_index;
    if (!bankAccounts[idx]) bankAccounts[idx] = {};
    bankAccounts[idx][input.dataset.bank_field] = input.value;
  });

  const shippers = [];
  document.querySelectorAll("[data-shipper-index]").forEach(input => {
    const idx = input.dataset.shipper_index;
    if (!shippers[idx]) shippers[idx] = {};
    shippers[idx][input.dataset.shipper_field] = input.value;
  });

  const payload = {
    name: fd.get("name"),
    address: fd.get("address"),
    bank_accounts: bankAccounts.filter(Boolean),
    shippers: shippers.filter(Boolean)
  };

  const { error } = await supabase.from("company_settings").update(payload).eq("id", 1);
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
  const [dealId, idx] = val.split(":");
  const docs = state.documentsByDeal[dealId] || [];
  const doc = docs[idx];
  if (doc && confirm("Delete document?")) {
    await supabase.from("deal_documents").update({ is_deleted: true }).eq("id", doc.id);
    await loadSupabaseData();
  }
}

// Export Actions
function exportDealsCsv() {
  const rows = state.deals.map(d => [d.deal_no, d.product_name, d.total_amount, d.status].join(","));
  const csv = "Deal No,Product,Total,Status\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "deals.csv";
  a.click();
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
  let html = "";
  if (type === "pi") html = buildPI(dealDoc, buyer, supplier, state.company);
  if (type === "ci") html = buildCI(dealDoc, buyer, supplier, state.company);
  if (type === "pl") html = buildPL(dealDoc, buyer, supplier, state.company);
  if (type === "coo") html = buildCOO(dealDoc, buyer, supplier, state.company);
  if (html) openPrintWindow(html);
}

// Start
loadSession();