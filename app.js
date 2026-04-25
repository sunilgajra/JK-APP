import { openPrintWindow, buildPI, buildCI, buildPL, buildCOO, buildShippingInstruction, buildSupplierStatement, buildBuyerStatement } from "./documents.js";
import { supabase } from "./supabase.js";
import { state, buyerName, supplierName, getBuyerById, getDealById, getShipperOptions, paymentsForDeal, paymentSummary } from "./state.js";
import { esc, cleanText, cleanUpper, cleanNumber, normalizeCustomerId, ensureDocNumbers } from "./utils.js";

// Import Views
import { dashboardView } from "./dashboard.js";
import { buyersView, buyerFormHtml } from "./buyers.js";
import { suppliersView, supplierFormHtml } from "./suppliers.js";
import { dealsView, dealFormHtml } from "./deals.js";
import { dealDetailView } from "./dealDetail.js";
import { settingsView } from "./settings.js";
import { shippingInstructionsView } from "./shipping.js";
import { productsView, productEditFormHtml } from "./products.js";

console.log("APP STARTING - RESTORING STABILITY");

const content = document.getElementById("content");

/**
 * ROUTING
 */
function navigate(path) {
  window.location.hash = path;
}

function handleRoute() {
  const hash = window.location.hash || "#/";
  const parts = hash.split("/");
  state.page = parts[1] || "dashboard";
  state.selectedDealId = parts[2] || null;

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === state.page);
  });

  render();
}

window.addEventListener("hashchange", handleRoute);

/**
 * AUTH
 */
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    state.authUser = session.user;
    await loadSupabaseData();
  } else {
    render();
  }
}

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
  location.reload();
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
    render();
  } catch (err) {
    console.error("Load failed:", err);
  }
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
let lastFocusedId = null;
let lastSelectionStart = 0;

function render() {
  if (document.activeElement && document.activeElement.id) {
    lastFocusedId = document.activeElement.id;
    lastSelectionStart = document.activeElement.selectionStart;
  }

  if (!state.authUser) {
    document.getElementById("app-container").style.display = "none";
    document.getElementById("login-container").style.display = "block";
    document.getElementById("login-container").innerHTML = `
      <div class="card" style="max-width: 400px; margin: 100px auto;">
        <h2 class="title" style="margin-bottom: 20px;">LOGIN</h2>
        <form id="login-form" class="grid gap-12">
          <input type="email" name="email" placeholder="Email" required>
          <input type="password" name="password" placeholder="Password" required>
          <button type="submit" class="btn-primary">Login</button>
        </form>
      </div>
    `;
    bindUI();
    return;
  }

  document.getElementById("login-container").style.display = "none";
  document.getElementById("app-container").style.display = "block";

  if (state.page === "dashboard") content.innerHTML = dashboardView();
  else if (state.page === "buyers") content.innerHTML = buyersView();
  else if (state.page === "suppliers") content.innerHTML = suppliersView();
  else if (state.page === "deals") content.innerHTML = dealsView();
  else if (state.page === "dealDetail") content.innerHTML = dealDetailView();
  else if (state.page === "shipping") content.innerHTML = shippingInstructionsView();
  else if (state.page === "products") content.innerHTML = productsView();
  else if (state.page === "settings") content.innerHTML = settingsView();

  bindUI();

  if (lastFocusedId) {
    const el = document.getElementById(lastFocusedId);
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
      el.focus();
      try { el.setSelectionRange(lastSelectionStart, lastSelectionStart); } catch (e) {}
    }
  }
}

function bindUI() {
  document.getElementById("login-form")?.addEventListener("submit", loginUser);
  document.getElementById("logout-btn")?.addEventListener("click", logoutUser);
  
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.onclick = () => {
      if (btn.id === "open-company-settings") navigate("#/settings");
      else navigate("#/" + (btn.dataset.page || "dashboard"));
    };
  });

  const showBuyerBtn = document.getElementById("show-buyer-form");
  if (showBuyerBtn) showBuyerBtn.onclick = showBuyerForm;

  const showSupplierBtn = document.getElementById("show-supplier-form");
  if (showSupplierBtn) showSupplierBtn.onclick = showSupplierForm;

  const showDealBtn = document.getElementById("show-deal-form");
  if (showDealBtn) showDealBtn.onclick = showDealForm;

  const backDealsBtn = document.getElementById("back-to-deals");
  if (backDealsBtn) backDealsBtn.onclick = () => navigate("#/deals");

  document.getElementById("product-form")?.addEventListener("submit", saveProduct);

  const dealSearch = document.getElementById("deal-search");
  if (dealSearch) {
    dealSearch.addEventListener("input", (e) => {
      state.dealSearch = e.target.value;
      render();
    });
  }

  document.querySelectorAll("[data-open-deal]").forEach(btn => btn.addEventListener("click", () => navigate("#/deals/" + btn.dataset.openDeal)));
  document.querySelectorAll("[data-edit-buyer]").forEach(btn => btn.addEventListener("click", () => showEditBuyerForm(btn.dataset.editBuyer)));
  document.querySelectorAll("[data-delete-buyer]").forEach(btn => btn.addEventListener("click", () => deleteBuyer(btn.dataset.deleteBuyer)));
  document.querySelectorAll("[data-edit-supplier]").forEach(btn => btn.addEventListener("click", () => showEditSupplierForm(btn.dataset.editSupplier)));
  document.querySelectorAll("[data-delete-supplier]").forEach(btn => btn.addEventListener("click", () => deleteSupplier(btn.dataset.deleteSupplier)));
  document.querySelectorAll("[data-edit-deal]").forEach(btn => btn.addEventListener("click", () => showEditDealForm(btn.dataset.editDeal)));
  document.querySelectorAll("[data-delete-deal]").forEach(btn => btn.addEventListener("click", () => deleteDeal(btn.dataset.deleteDeal)));
  document.querySelectorAll("[data-edit-product]").forEach(btn => btn.addEventListener("click", () => showEditProductForm(btn.dataset.editProduct)));
  document.querySelectorAll("[data-delete-product]").forEach(btn => btn.addEventListener("click", () => deleteProduct(btn.dataset.deleteProduct)));

  document.querySelectorAll("[data-show-payment-form]").forEach(btn => btn.addEventListener("click", () => showPaymentForm(btn.dataset.showPaymentForm)));
  document.querySelectorAll("[data-delete-payment]").forEach(btn => btn.addEventListener("click", () => deletePayment(btn.dataset.deletePayment)));
  document.querySelectorAll("[data-show-document-form]").forEach(btn => btn.addEventListener("click", () => showDocumentForm(btn.dataset.showDocumentForm)));
  document.querySelectorAll("[data-ai-scan]").forEach(btn => btn.addEventListener("click", () => runAiScan(btn.dataset.aiScan)));

  document.querySelectorAll("[data-placeholder-upload]").forEach(form => form.addEventListener("submit", saveDealDocument));
  document.querySelectorAll("[data-delete-placeholder-doc]").forEach(btn => btn.addEventListener("click", () => deleteDealDocument(btn.dataset.deletePlaceholderDoc)));

  document.querySelectorAll("[data-print-pi]").forEach(btn => btn.addEventListener("click", () => window.open(`documents.html?type=PI&dealId=${btn.dataset.printPi}`, '_blank')));
  document.querySelectorAll("[data-print-ci]").forEach(btn => btn.addEventListener("click", () => window.open(`documents.html?type=CI&dealId=${btn.dataset.printCi}`, '_blank')));
  document.querySelectorAll("[data-print-pl]").forEach(btn => btn.addEventListener("click", () => window.open(`documents.html?type=PL&dealId=${btn.dataset.printPl}`, '_blank')));
  document.querySelectorAll("[data-print-coo]").forEach(btn => btn.addEventListener("click", () => window.open(`documents.html?type=COO&dealId=${btn.dataset.printCoo}`, '_blank')));
  
  document.getElementById("company-settings-form")?.addEventListener("submit", saveCompanySettings);
}

/**
 * LOGIC HANDLERS
 */

async function saveDeal(e) {
  e.preventDefault();
  const payload = validateDeal(new FormData(e.target));
  const { error } = await supabase.from("deals").insert(payload);
  if (error) alert(error.message);
  else await loadSupabaseData();
}

async function updateDeal(e, id) {
  e.preventDefault();
  const payload = validateDeal(new FormData(e.target));
  const { error } = await supabase.from("deals").update(payload).eq("id", id);
  if (error) alert(error.message);
  else await loadSupabaseData();
}

async function deleteDeal(id) {
  if (confirm("Delete?")) {
    await supabase.from("deals").delete().eq("id", id);
    await loadSupabaseData();
  }
}

function showDealForm() {
  const wrap = document.getElementById("deal-form-wrap");
  if (!wrap) return;
  wrap.innerHTML = dealFormHtml({}, false);
  document.getElementById("deal-form").addEventListener("submit", saveDeal);
  document.getElementById("cancel-deal-form").addEventListener("click", () => wrap.innerHTML = "");
  bindDealAutoTotal();
}

function showEditDealForm(id) {
  const d = state.deals.find(x => String(x.id) === String(id));
  const wrap = document.getElementById(`deal-edit-wrap-${id}`);
  if (!d || !wrap) return;
  wrap.innerHTML = dealFormHtml(d, true, id);
  document.getElementById(`deal-edit-form-${id}`).addEventListener("submit", (e) => updateDeal(e, id));
  document.getElementById(`cancel-deal-edit-${id}`).addEventListener("click", () => wrap.innerHTML = "");
  bindDealAutoTotal(id);
}

function validateDeal(fd) {
  return {
    deal_no: fd.get("deal_no"), product_name: fd.get("product_name"), hsn_code: fd.get("hsn_code"),
    quantity: Number(fd.get("quantity")), rate: Number(fd.get("rate")), purchase_rate: Number(fd.get("purchase_rate")),
    conversion_rate: Number(fd.get("conversion_rate")),
    total_amount_usd: Number(fd.get("quantity")) * Number(fd.get("rate")),
    status: fd.get("status"), loading_port: fd.get("loading_port"), discharge_port: fd.get("discharge_port"),
    buyer_id: fd.get("buyer_id"), supplier_id: fd.get("supplier_id"),
    vessel: fd.get("vessel"), bl_no: fd.get("bl_no"),
    container_numbers: String(fd.get("container_numbers") || "").split("\n").map(x => x.trim()).filter(Boolean)
  };
}

function showBuyerForm() {
  const wrap = document.getElementById("buyer-form-wrap");
  if (!wrap) return;
  wrap.innerHTML = buyerFormHtml();
  document.getElementById("buyer-form").addEventListener("submit", saveBuyer);
  document.getElementById("cancel-buyer-form").onclick = () => wrap.innerHTML = "";
}

function showEditBuyerForm(id) {
  const b = state.buyers.find(x => String(x.id) === String(id));
  const wrap = document.getElementById(`buyer-edit-wrap-${id}`);
  if (!b || !wrap) return;
  wrap.innerHTML = buyerFormHtml(b, true, id);
  document.getElementById(`buyer-edit-form-${id}`).addEventListener("submit", (e) => updateBuyer(e, id));
  document.getElementById(`cancel-buyer-edit-${id}`).onclick = () => wrap.innerHTML = "";
}

async function saveBuyer(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  await supabase.from("buyers").insert({ name: fd.get("name"), customer_id: fd.get("customer_id"), address: fd.get("address") });
  await loadSupabaseData();
}

async function updateBuyer(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);
  await supabase.from("buyers").update({ name: fd.get("name"), address: fd.get("address") }).eq("id", id);
  await loadSupabaseData();
}

async function deleteBuyer(id) {
  if (confirm("Delete?")) {
    await supabase.from("buyers").delete().eq("id", id);
    await loadSupabaseData();
  }
}

function showSupplierForm() {
  const wrap = document.getElementById("supplier-form-wrap");
  if (!wrap) return;
  wrap.innerHTML = supplierFormHtml();
  document.getElementById("supplier-form").addEventListener("submit", saveSupplier);
  document.getElementById("cancel-supplier-form").onclick = () => wrap.innerHTML = "";
}

function showEditSupplierForm(id) {
  const s = state.suppliers.find(x => String(x.id) === String(id));
  const wrap = document.getElementById(`supplier-edit-wrap-${id}`);
  if (!s || !wrap) return;
  wrap.innerHTML = supplierFormHtml(s, true, id);
  document.getElementById(`supplier-edit-form-${id}`).addEventListener("submit", (e) => updateSupplier(e, id));
  document.getElementById(`cancel-supplier-edit-${id}`).onclick = () => wrap.innerHTML = "";
}

async function saveSupplier(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  await supabase.from("suppliers").insert({ name: fd.get("name"), company_name: fd.get("company_name") });
  await loadSupabaseData();
}

async function updateSupplier(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);
  await supabase.from("suppliers").update({ name: fd.get("name"), company_name: fd.get("company_name") }).eq("id", id);
  await loadSupabaseData();
}

async function deleteSupplier(id) {
  if (confirm("Delete?")) {
    await supabase.from("suppliers").delete().eq("id", id);
    await loadSupabaseData();
  }
}

function showPaymentForm(dealId) {
  const wrap = document.getElementById(`payment-form-wrap-${dealId}`);
  if (!wrap) return;
  wrap.innerHTML = `
    <form id="payment-form-${dealId}" class="item">
      <input name="amount" type="number" step="0.01" placeholder="Amount" required>
      <input name="currency" value="USD">
      <input name="payment_date" type="date" value="${new Date().toISOString().split("T")[0]}">
      <button type="submit" class="btn-primary">SAVE</button>
    </form>
  `;
  document.getElementById(`payment-form-${dealId}`).onsubmit = (e) => savePayment(e, dealId);
}

async function savePayment(e, dealId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  await supabase.from("payments").insert({ deal_id: dealId, amount: fd.get("amount"), currency: fd.get("currency"), direction: "in", payment_date: fd.get("payment_date") });
  await loadSupabaseData();
}

async function deletePayment(val) {
  const [dealId, payId] = val.split(":");
  await supabase.from("payments").delete().eq("id", payId);
  await loadSupabaseData();
}

function showDocumentForm(dealId) {
  const wrap = document.getElementById(`document-form-wrap-${dealId}`);
  if (!wrap) return;
  wrap.innerHTML = `
    <form data-placeholder-upload="${dealId}" class="item">
      <select name="docType"><option value="BL">BL</option><option value="Other">Other</option></select>
      <input type="file" name="file" required>
      <button type="submit" class="btn-primary">UPLOAD</button>
    </form>
  `;
  wrap.querySelector("form").onsubmit = saveDealDocument;
}

async function saveDealDocument(e) {
  e.preventDefault();
  const form = e.target;
  const dealId = form.dataset.placeholderUpload;
  const fd = new FormData(form);
  const file = fd.get("file");
  if (file) {
    const { data, error } = await supabase.storage.from("documents").upload(`deals/${dealId}/${Date.now()}_${file.name}`, file);
    if (error) return alert(error.message);
    const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(data.path);
    await supabase.from("deal_documents").insert({ deal_id: dealId, doc_type: fd.get("docType"), file_name: file.name, file_url: publicUrl });
    await loadSupabaseData();
  }
}

async function deleteDealDocument(val) {
  const [dealId, docId] = val.split(":");
  await supabase.from("deal_documents").update({ is_deleted: true }).eq("id", docId);
  await loadSupabaseData();
}

async function saveProduct(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  await supabase.from("products").insert({ name: fd.get("name"), hsn_code: fd.get("hsn_code") });
  await loadProducts();
  render();
}

function showEditProductForm(id) {
  const p = state.products.find(x => String(x.id) === String(id));
  const wrap = document.getElementById(`product-edit-wrap-${id}`);
  if (!p || !wrap) return;
  wrap.innerHTML = productEditFormHtml(p);
  document.getElementById(`product-edit-form-${id}`).onsubmit = (e) => updateProduct(e, id);
}

async function updateProduct(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);
  await supabase.from("products").update({ name: fd.get("name"), hsn_code: fd.get("hsn_code") }).eq("id", id);
  await loadProducts();
  render();
}

async function deleteProduct(id) {
  await supabase.from("products").delete().eq("id", id);
  await loadProducts();
  render();
}

function bindDealAutoTotal(id = null) {
  const suffix = id ? `-${id}` : "";
  const q = document.getElementById(`quantity${suffix}`);
  const r = document.getElementById(`rate${suffix}`);
  const t = document.getElementById(`total${suffix}`);
  const calc = () => { if (t) t.value = (Number(q?.value || 0) * Number(r?.value || 0)).toFixed(2); };
  q?.addEventListener("input", calc);
  r?.addEventListener("input", calc);
}

async function saveCompanySettings(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  await supabase.from("company_settings").update({ name: fd.get("name"), gemini_api_key: fd.get("gemini_api_key") }).eq("id", 1);
  await loadSupabaseData();
}

async function runAiScan(val) { alert("AI Scan: " + val); }

// Start
init();