import { openPrintWindow, buildPI, buildCI, buildPL, buildCOO } from "./documents.js?v=7";
import { supabase } from "./supabase.js?v=7";
import { state, buyerName, supplierName, getBuyerById, getDealById, getShipperOptions, paymentsForDeal } from "./state.js?v=7";
import { esc, cleanText, cleanUpper, cleanNumber, normalizeCustomerId, ensureDocNumbers } from "./utils.js?v=7";

// Import Views (Now from the root folder)
import { dashboardView } from "./dashboard.js?v=7";
import { buyersView, buyerFormHtml } from "./buyers.js?v=7";
import { suppliersView, supplierFormHtml } from "./suppliers.js?v=7";
import { dealsView, dealFormHtml } from "./deals.js?v=7";
import { dealDetailView } from "./dealDetail.js?v=7";
import { settingsView } from "./settings.js?v=7";
import { shippingInstructionsView } from "./shipping.js?v=7";
import { productsView, productEditFormHtml } from "./products.js?v=7";

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
  const email = String(fd.get("email") || "").trim();
  const password = String(fd.get("password") || "").trim();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return alert(error.message);

  state.authUser = data.user || null;
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
  } catch (err) {
    console.error(err);
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
  document.getElementById("login-form")?.addEventListener("submit", loginUser);
  document.getElementById("logout-btn")?.addEventListener("click", logoutUser);
  document.getElementById("show-buyer-form")?.addEventListener("click", showBuyerForm);
  document.getElementById("show-supplier-form")?.addEventListener("click", showSupplierForm);
  document.getElementById("show-deal-form")?.addEventListener("click", showDealForm);
  document.getElementById("back-to-deals")?.addEventListener("click", () => navigate("#/deals"));
  document.getElementById("open-company-settings")?.addEventListener("click", () => navigate("#/settings"));
  document.getElementById("export-deals-csv")?.addEventListener("click", exportDealsCsv);
  document.getElementById("product-form")?.addEventListener("submit", saveProduct);

  document.getElementById("deal-search")?.addEventListener("input", (e) => { state.dealSearch = e.target.value; render(); });
  document.getElementById("buyer-search")?.addEventListener("input", (e) => { state.buyerSearch = e.target.value; render(); });
  document.getElementById("supplier-search")?.addEventListener("input", (e) => { state.supplierSearch = e.target.value; render(); });

  document.querySelectorAll("[data-open-deal]").forEach(btn => btn.addEventListener("click", () => navigate("#/deals/" + btn.dataset.openDeal)));
  document.querySelectorAll("[data-edit-buyer]").forEach(btn => btn.addEventListener("click", () => showEditBuyerForm(btn.dataset.editBuyer)));
  document.querySelectorAll("[data-delete-buyer]").forEach(btn => btn.addEventListener("click", () => deleteBuyer(btn.dataset.deleteBuyer)));
  document.querySelectorAll("[data-edit-supplier]").forEach(btn => btn.addEventListener("click", () => showEditSupplierForm(btn.dataset.editSupplier)));
  document.querySelectorAll("[data-delete-supplier]").forEach(btn => btn.addEventListener("click", () => deleteSupplier(btn.dataset.deleteSupplier)));
  document.querySelectorAll("[data-edit-deal]").forEach(btn => btn.addEventListener("click", () => showEditDealForm(btn.dataset.editDeal)));
  document.querySelectorAll("[data-delete-deal]").forEach(btn => btn.addEventListener("click", () => deleteDeal(btn.dataset.deleteDeal)));
  
  document.querySelectorAll("[data-print-pi]").forEach(btn => btn.addEventListener("click", () => printDoc("pi", btn.dataset.printPi)));
  document.querySelectorAll("[data-print-ci]").forEach(btn => btn.addEventListener("click", () => printDoc("ci", btn.dataset.printCi)));
  document.querySelectorAll("[data-print-pl]").forEach(btn => btn.addEventListener("click", () => printDoc("pl", btn.dataset.printPl)));
  document.querySelectorAll("[data-print-coo]").forEach(btn => btn.addEventListener("click", () => printDoc("coo", btn.dataset.printCoo)));

  document.querySelectorAll("[data-show-payment-form]").forEach(btn => btn.addEventListener("click", () => showPaymentForm(btn.dataset.showPaymentForm)));
  
  bindShippingInstructionForm();
}

/**
 * UI HELPERS
 */
function loginView() {
  return `
    <div class="card" style="max-width:420px;margin:40px auto">
      <div class="title mb-12">Login</div>
      <form id="login-form" class="item">
        <div class="grid gap-10">
          <div>
            <label class="form-label">Email</label>
            <input name="email" type="email" placeholder="Email" required>
          </div>
          <div>
            <label class="form-label">Password</label>
            <input name="password" type="password" placeholder="Password" required>
          </div>
          <button type="submit" class="btn-primary">Login</button>
        </div>
      </form>
    </div>
  `;
}

function showBuyerForm() {
  const wrap = document.getElementById("buyer-form-wrap");
  if (!wrap) return;
  wrap.innerHTML = buyerFormHtml();
  document.getElementById("buyer-form").addEventListener("submit", saveBuyer);
  document.getElementById("cancel-buyer-form").addEventListener("click", () => wrap.innerHTML = "");
}

function showEditBuyerForm(id) {
  const b = state.buyers.find(x => String(x.id) === String(id));
  const wrap = document.getElementById(`buyer-edit-wrap-${id}`);
  if (!b || !wrap) return;
  wrap.innerHTML = buyerFormHtml(b, true, id);
  document.getElementById(`buyer-edit-form-${id}`).addEventListener("submit", (e) => updateBuyer(e, id));
  document.getElementById(`cancel-buyer-edit-${id}`).addEventListener("click", () => wrap.innerHTML = "");
}

async function saveBuyer(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const { error } = await supabase.from("buyers").insert({
    name: fd.get("name"), address: fd.get("address"), gst: fd.get("gst"), iec: fd.get("iec"), pan: fd.get("pan"),
    customer_id: normalizeCustomerId(fd.get("customer_id")), phone: fd.get("phone")
  });
  if (error) return alert(error.message);
  await loadSupabaseData();
}

async function updateBuyer(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const { error } = await supabase.from("buyers").update({
    name: fd.get("name"), address: fd.get("address"), gst: fd.get("gst"), iec: fd.get("iec"), pan: fd.get("pan"),
    customer_id: normalizeCustomerId(fd.get("customer_id")), phone: fd.get("phone")
  }).eq("id", id);
  if (error) return alert(error.message);
  await loadSupabaseData();
}

async function deleteBuyer(id) {
  if (confirm("Delete buyer?")) {
    await supabase.from("buyers").delete().eq("id", id);
    await loadSupabaseData();
  }
}

function showDealForm() {
  const wrap = document.getElementById("deal-form-wrap");
  if (!wrap) return;
  wrap.innerHTML = dealFormHtml({}, false);
  document.getElementById("deal-form").addEventListener("submit", saveDeal);
  document.getElementById("cancel-deal-form").addEventListener("click", () => wrap.innerHTML = "");
}

function showEditDealForm(id) {
  const d = state.deals.find(x => String(x.id) === String(id));
  const wrap = document.getElementById(`deal-edit-wrap-${id}`);
  if (!d || !wrap) return;
  wrap.innerHTML = dealFormHtml(d, true, id);
  document.getElementById(`deal-edit-form-${id}`).addEventListener("submit", (e) => updateDeal(e, id));
  document.getElementById(`cancel-deal-edit-${id}`).addEventListener("click", () => wrap.innerHTML = "");
}

async function saveDeal(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = ensureDocNumbers({
    deal_no: fd.get("deal_no"), product_name: fd.get("product_name"), 
    quantity: Number(fd.get("quantity")), rate: Number(fd.get("rate")),
    buyer_id: fd.get("buyer_id") || null, supplier_id: fd.get("supplier_id") || null
  });
  await supabase.from("deals").insert(payload);
  await loadSupabaseData();
}

async function updateDeal(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);
  await supabase.from("deals").update({ deal_no: fd.get("deal_no"), product_name: fd.get("product_name") }).eq("id", id);
  await loadSupabaseData();
}

async function deleteDeal(id) {
  if (confirm("Delete deal?")) {
    await supabase.from("deals").delete().eq("id", id);
    await loadSupabaseData();
  }
}

async function saveProduct(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  await supabase.from("products").insert({ name: fd.get("name"), hsn_code: fd.get("hsn_code") });
  await loadProducts();
  render();
}

function showPaymentForm(id) { alert("Payment form for " + id); }
function exportDealsCsv() { alert("Exporting..."); }
function bindShippingInstructionForm() {} 

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