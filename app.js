import { openPrintWindow, buildPI, buildCI, buildPL, buildCOO, buildCOA, buildDocumentSet, buildShippingInstruction, buildSupplierStatement, buildBuyerStatement, buildSupplierMasterStatement, buildBuyerMasterStatement, buildAgentStatement } from "./documents.js";
import { supabase } from "./supabase.js";
import { state, buyerName, supplierName, getBuyerById, getDealById, getShipperOptions, paymentsForDeal, paymentSummary } from "./state.js";
import { esc, cleanText, cleanUpper, cleanNumber, normalizeCustomerId, ensureDocNumbers, cleanContainerNumbers } from "./utils.js";

// Import Views (Flat Structure)
import { dashboardView } from "./dashboard.js";
import { buyersView, buyerFormHtml } from "./buyers.js";
import { suppliersView, supplierFormHtml } from "./suppliers.js";
import { agentsView, agentFormHtml, agentPaymentFormHtml } from "./agents.js";
import { dealsView, dealFormHtml, highSeasFormHtml } from "./deals.js";
import { dealDetailView } from "./dealDetail.js";
import { settingsView } from "./settings.js";
import { shippingInstructionsView } from "./shipping.js";
import { poView, bindPOUI } from "./po.js";
import { productsView, productEditFormHtml } from "./products.js";
import { reportsView, bindReportsUI } from "./reports.js";
import { trackingView, performQuickTrack } from "./tracking.js";

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
  } else if (hash === "#/agents") {
    state.page = "agents";
  } else if (hash === "#/settings") {
    state.page = "settings";
  } else if (hash === "#/deals") {
    state.page = "deals";
  } else if (hash === "#/shipping") {
    state.page = "shippingInstructions";
  } else if (hash === "#/products") {
    state.page = "products";
  } else if (hash === "#/po") {
    state.page = "po";
  } else if (hash === "#/reports") {
    state.page = "reports";
  } else if (hash === "#/tracking") {
    state.page = "tracking";
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
    const [buyersRes, suppliersRes, agentsRes, dealsRes, paymentsRes, agentPaymentsRes, documentsRes, auditRes] = await Promise.all([
      supabase.from("buyers").select("*").order("id", { ascending: false }),
      supabase.from("suppliers").select("*").order("id", { ascending: false }),
      supabase.from("commission_agents").select("*").order("id", { ascending: false }),
      supabase.from("deals").select("*").order("id", { ascending: false }),
      supabase.from("payments").select("*").order("id", { ascending: false }),
      supabase.from("agent_payments").select("*").order("payment_date", { ascending: false }),
      supabase.from("deal_documents").select("*").eq("is_deleted", false).order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false })
    ]);

    if (buyersRes.error) throw buyersRes.error;
    if (suppliersRes.error) throw suppliersRes.error;
    if (agentsRes.error && agentsRes.error.code !== "PGRST116") {
       console.warn("Agents table might not exist yet:", agentsRes.error);
    }
    if (dealsRes.error) throw dealsRes.error;

    state.buyers = buyersRes.data || [];
    state.suppliers = suppliersRes.data || [];
    state.agents = agentsRes.data || [];
    state.deals = dealsRes.data || [];

    const groupedPayments = {};
    (paymentsRes.data || []).forEach(p => {
      const k = String(p.deal_id);
      if (!groupedPayments[k]) groupedPayments[k] = [];
      groupedPayments[k].push(p);
    });
    state.paymentsByDeal = groupedPayments;

    const groupedAgentPayments = {};
    (agentPaymentsRes.data || []).forEach(p => {
      const k = String(p.agent_id);
      if (!groupedAgentPayments[k]) groupedAgentPayments[k] = [];
      groupedAgentPayments[k].push(p);
    });
    state.agentPaymentsByAgent = groupedAgentPayments;

    const groupedDocs = {};
    const groupedSupplierDocs = {};
    const groupedBuyerDocs = {};
    const companyDocs = [];

    (documentsRes.data || []).forEach(doc => {
      if (doc.deal_id) {
        const k = String(doc.deal_id);
        if (!groupedDocs[k]) groupedDocs[k] = [];
        groupedDocs[k].push(doc);
      }
      if (doc.supplier_id) {
        const k = String(doc.supplier_id);
        if (!groupedSupplierDocs[k]) groupedSupplierDocs[k] = [];
        groupedSupplierDocs[k].push(doc);
      }
      if (doc.buyer_id) {
        const k = String(doc.buyer_id);
        if (!groupedBuyerDocs[k]) groupedBuyerDocs[k] = [];
        groupedBuyerDocs[k].push(doc);
      }
      if (!doc.deal_id && !doc.supplier_id && !doc.buyer_id) {
        companyDocs.push(doc);
      }
    });

    state.documentsByDeal = groupedDocs;
    state.documentsBySupplier = groupedSupplierDocs;
    state.documentsByBuyer = groupedBuyerDocs;
    state.documentsByCompany = companyDocs;

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
    await loadPurchaseOrders();

    state.ready = true;
  } catch (err) {
    console.error("Load failed:", err);
  }
  handleRoute();
}

async function loadPurchaseOrders() {
  const { data } = await supabase.from("purchase_orders").select("*").order("id", { ascending: false });
  if (data) state.purchaseOrders = data;
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
      gemini_api_key: data.gemini_api_key || localStorage.getItem("gemini_api_key") || "",
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
let lastFocusedId = null;
let lastSelectionStart = 0;

function render() {
  console.log("Rendering page:", state.page);
  
  // Remember focus
  if (document.activeElement && document.activeElement.id) {
    lastFocusedId = document.activeElement.id;
    lastSelectionStart = document.activeElement.selectionStart;
  }

  if (!state.authUser) {
    content.innerHTML = loginView();
    bindUI();
    return;
  }

  if (state.page === "dashboard") content.innerHTML = dashboardView();
  else if (state.page === "buyers") content.innerHTML = buyersView();
  else if (state.page === "suppliers") content.innerHTML = suppliersView();
  else if (state.page === "agents") content.innerHTML = agentsView();
  else if (state.page === "deals") content.innerHTML = dealsView();
  else if (state.page === "dealDetail") content.innerHTML = dealDetailView();
  else if (state.page === "po") content.innerHTML = poView();
  else if (state.page === "shippingInstructions") content.innerHTML = shippingInstructionsView();
  else if (state.page === "tracking") content.innerHTML = trackingView();
  else if (state.page === "products") content.innerHTML = productsView();
  else if (state.page === "reports") content.innerHTML = reportsView();
  else if (state.page === "settings") content.innerHTML = settingsView();

  bindUI();

  // Restore focus
  if (lastFocusedId) {
    const el = document.getElementById(lastFocusedId);
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
      el.focus();
      try {
        el.setSelectionRange(lastSelectionStart, lastSelectionStart);
      } catch (e) {}
    }
  }
}

function bindUI() {
  console.log("Binding UI for page:", state.page);
  document.getElementById("login-form")?.addEventListener("submit", loginUser);
  document.getElementById("logout-btn")?.addEventListener("click", logoutUser);
  
  if (state.page === "reports") bindReportsUI();
  if (state.page === "po") bindPOUI();
  if (state.page === "dashboard") bindDashboardUI();
  
  // Navigation
  document.getElementById("show-buyer-form")?.addEventListener("click", showBuyerForm);
  document.getElementById("show-supplier-form")?.addEventListener("click", showSupplierForm);
  document.getElementById("show-deal-form")?.addEventListener("click", showDealForm);
  document.getElementById("back-to-deals")?.addEventListener("click", () => navigate("#/deals"));
  document.getElementById("open-company-settings")?.addEventListener("click", () => navigate("#/settings"));
  document.getElementById("product-form")?.addEventListener("submit", saveProduct);

  // Agents
  document.getElementById("show-agent-form")?.addEventListener("click", showAgentForm);
  document.getElementById("agent-search")?.addEventListener("input", (e) => {
    state.agentSearch = e.target.value;
    render();
  });
  document.getElementById("agent-form")?.addEventListener("submit", saveAgent);
  document.getElementById("cancel-agent-form")?.addEventListener("click", () => {
    document.getElementById("agent-form-wrap").innerHTML = "";
  });
  document.querySelectorAll("[data-edit-agent]").forEach(btn => btn.addEventListener("click", () => showEditAgentForm(btn.dataset.editAgent)));
  document.querySelectorAll("[data-delete-agent]").forEach(btn => btn.addEventListener("click", () => deleteAgent(btn.dataset.deleteAgent)));
  
  // Agent Statement Selection
  document.querySelectorAll("[data-show-agent-statement-deals]").forEach(btn => btn.addEventListener("click", () => {
    const id = btn.dataset.showAgentStatementDeals;
    const wrap = document.getElementById(`agent-statement-deals-wrap-${id}`);
    if (wrap) wrap.style.display = wrap.style.display === "none" ? "block" : "none";
  }));
  document.querySelectorAll("[data-select-all-agent-deals]").forEach(cb => cb.addEventListener("change", (e) => {
    const id = cb.dataset.selectAllAgentDeals;
    document.querySelectorAll(`input[name="agent_deal_ids_${id}"]`).forEach(box => box.checked = e.target.checked);
  }));
  document.querySelectorAll("[data-print-agent-statement-selected]").forEach(btn => btn.addEventListener("click", () => {
    const agentId = btn.dataset.printAgentStatementSelected;
    const selectedIds = Array.from(document.querySelectorAll(`input[name="agent_deal_ids_${agentId}"]:checked`)).map(cb => cb.value);
    if (!selectedIds.length) return alert("Please select at least one deal.");
    printAgentStatement(agentId, selectedIds);
  }));

  // Agent Payments
  document.querySelectorAll("[data-show-agent-payments]").forEach(btn => btn.addEventListener("click", () => {
    const id = btn.dataset.showAgentPayments;
    const wrap = document.getElementById(`agent-payments-wrap-${id}`);
    if (wrap) wrap.style.display = wrap.style.display === "none" ? "block" : "none";
  }));
  document.querySelectorAll("[data-add-agent-payment]").forEach(btn => btn.addEventListener("click", () => showAgentPaymentForm(btn.dataset.addAgentPayment)));
  document.querySelectorAll("[data-edit-agent-payment]").forEach(btn => btn.addEventListener("click", () => {
    const [agentId, paymentId] = btn.dataset.editAgentPayment.split(":");
    showEditAgentPaymentForm(agentId, paymentId);
  }));
  document.querySelectorAll("[data-delete-agent-payment]").forEach(btn => btn.addEventListener("click", () => deleteAgentPayment(btn.dataset.deleteAgentPayment)));

  // Tracking
  document.getElementById("btn-quick-track")?.addEventListener("click", performQuickTrack);
  document.querySelectorAll("[data-track-deal-bl]").forEach(btn => btn.addEventListener("click", () => trackDeal(btn.dataset.trackDealBl)));
  document.querySelectorAll("[data-update-tracking]").forEach(btn => btn.addEventListener("click", () => {
    const id = btn.dataset.updateTracking;
    const wrap = document.getElementById(`update-tracking-wrap-${id}`);
    if (wrap) wrap.style.display = wrap.style.display === "none" ? "block" : "none";
  }));
  document.querySelectorAll("[data-save-tracking]").forEach(btn => btn.addEventListener("click", () => saveTrackingLog(btn.dataset.saveTracking)));


  
  document.querySelectorAll("[data-ai-scan]").forEach(btn => btn.addEventListener("click", () => {
    const [dealId, docId] = btn.dataset.aiScan.split(":");
    runAiScan(dealId, docId);
  }));

  document.getElementById("check-ai-btn")?.addEventListener("click", checkAiConnection);

  // Search - with preservation of cursor
  const dealSearch = document.getElementById("deal-search");
  if (dealSearch) {
    dealSearch.value = state.dealSearch || "";
    dealSearch.addEventListener("input", (e) => {
      state.dealSearch = e.target.value;
      render();
    });
  }

  const dealStatusFilter = document.getElementById("deal-status-filter");
  if (dealStatusFilter) {
    dealStatusFilter.addEventListener("change", (e) => {
      state.dealStatusFilter = e.target.value;
      render();
    });
  }

  document.querySelectorAll("[data-share-whatsapp]").forEach(btn => btn.addEventListener("click", () => {
    const deal = getDealById(btn.dataset.shareWhatsapp);
    if (!deal) return;
    
    const curr = deal.document_currency || deal.currency || "AED";
    const saleVal = curr === "USD" ? (deal.total_amount_usd || 0) : (deal.total_amount_aed || deal.total_amount || 0);
    const purchaseVal = curr === "USD" ? (deal.purchase_total_usd || 0) : (deal.purchase_total_aed || 0);
    
    const s = paymentSummary(deal.id, saleVal, purchaseVal, curr);
    
    const text = `*JK TRADE MANAGER - DEAL SUMMARY*%0A` +
                 `Deal No: ${deal.deal_no}%0A` +
                 `Product: ${deal.product_name}%0A` +
                 `BL No: ${deal.bl_no || "—"}%0A` +
                 `Status: ${deal.status.toUpperCase()}%0A%0A` +
                 `*Payment Status:*%0A` +
                 `Total Sale: ${curr} ${s.sale.toLocaleString(undefined, {minimumFractionDigits: 2})}%0A` +
                 `Received: ${curr} ${s.received.toLocaleString(undefined, {minimumFractionDigits: 2})}%0A` +
                 `*Outstanding: ${curr} ${s.receivable.toLocaleString(undefined, {minimumFractionDigits: 2})}*%0A%0A` +
                 `_Sent via JK Trade Manager_`;
    
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }));

  const buyerSearch = document.getElementById("buyer-search");
  if (buyerSearch) {
    buyerSearch.value = state.buyerSearch || "";
    buyerSearch.addEventListener("input", (e) => {
      state.buyerSearch = e.target.value;
      render();
    });
  }

  const supplierSearch = document.getElementById("supplier-search");
  if (supplierSearch) {
    supplierSearch.value = state.supplierSearch || "";
    supplierSearch.addEventListener("input", (e) => {
      state.supplierSearch = e.target.value;
      render();
    });
  }

  // List Actions
  document.querySelectorAll("[data-open-deal]").forEach(btn => btn.addEventListener("click", () => navigate("#/deals/" + btn.dataset.openDeal)));
  document.querySelectorAll("[data-edit-buyer]").forEach(btn => btn.addEventListener("click", () => showEditBuyerForm(btn.dataset.editBuyer)));
  document.querySelectorAll("[data-delete-buyer]").forEach(btn => btn.addEventListener("click", () => deleteBuyer(btn.dataset.deleteBuyer)));
  document.querySelectorAll("[data-edit-supplier]").forEach(btn => btn.addEventListener("click", () => showEditSupplierForm(btn.dataset.editSupplier)));
  document.querySelectorAll("[data-delete-supplier]").forEach(btn => btn.addEventListener("click", () => deleteSupplier(btn.dataset.deleteSupplier)));
  document.querySelectorAll("[data-edit-deal]").forEach(btn => btn.addEventListener("click", () => showEditDealForm(btn.dataset.editDeal)));
  document.querySelectorAll("[data-high-seas]").forEach(btn => btn.addEventListener("click", () => showHighSeasForm(btn.dataset.highSeas)));
  document.querySelectorAll("[data-delete-deal]").forEach(btn => btn.addEventListener("click", () => deleteDeal(btn.dataset.deleteDeal)));
  document.querySelectorAll("[data-edit-product]").forEach(btn => btn.addEventListener("click", () => showEditProductForm(btn.dataset.editProduct)));
  document.querySelectorAll("[data-delete-product]").forEach(btn => btn.addEventListener("click", () => deleteProduct(btn.dataset.deleteProduct)));
  
  // Document Toggle Buttons
  document.querySelectorAll("[data-show-supplier-docs]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-show-supplier-docs");
      const wrap = document.getElementById(`supplier-docs-wrap-${id}`);
      if (wrap) wrap.style.display = wrap.style.display === "none" ? "block" : "none";
    });
  });

  document.querySelectorAll("[data-show-buyer-docs]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-show-buyer-docs");
      const wrap = document.getElementById(`buyer-docs-wrap-${id}`);
      if (wrap) wrap.style.display = wrap.style.display === "none" ? "block" : "none";
    });
  });

  document.querySelectorAll("[data-delete-supplier-doc]").forEach(btn => {
    btn.addEventListener("click", (e) => deleteSupplierDocument(e.currentTarget.getAttribute("data-delete-supplier-doc")));
  });

  document.querySelectorAll("[data-delete-buyer-doc]").forEach(btn => {
    btn.addEventListener("click", (e) => deleteBuyerDocument(e.currentTarget.getAttribute("data-delete-buyer-doc")));
  });

  document.querySelectorAll("[data-delete-company-doc]").forEach(btn => {
    btn.addEventListener("click", (e) => deleteCompanyDocument(e.currentTarget.getAttribute("data-delete-company-doc")));
  });

  document.querySelectorAll("[data-share-whatsapp-doc]").forEach(btn => {
    btn.addEventListener("click", (e) => shareDocViaWhatsapp(e.currentTarget.getAttribute("data-share-whatsapp-doc")));
  });

  document.querySelectorAll("[data-ai-expiry-scan]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const docId = e.currentTarget.getAttribute("data-ai-expiry-scan");
      runExpiryScan(docId);
    });
  });

  document.querySelectorAll("[data-supplier-doc-upload]").forEach(form => form.addEventListener("submit", saveSupplierDocument));
  document.querySelectorAll("[data-buyer-doc-upload]").forEach(form => form.addEventListener("submit", saveBuyerDocument));
  document.querySelectorAll("[data-company-doc-upload]").forEach(form => form.addEventListener("submit", saveCompanyDocument));
  
  // Print
  document.querySelectorAll("[data-print-pi]").forEach(btn => btn.addEventListener("click", () => printDoc("pi", btn.dataset.printPi)));
  document.querySelectorAll("[data-print-ci]").forEach(btn => btn.addEventListener("click", () => printDoc("ci", btn.dataset.printCi)));
  document.querySelectorAll("[data-print-pl]").forEach(btn => btn.addEventListener("click", () => printDoc("pl", btn.dataset.printPl)));
  document.querySelectorAll("[data-print-coo]").forEach(btn => btn.addEventListener("click", () => printDoc("coo", btn.dataset.printCoo)));
  document.querySelectorAll("[data-print-coa]").forEach(btn => btn.addEventListener("click", () => showCOAForm(btn.dataset.printCoa)));
  document.querySelectorAll("[data-print-set]").forEach(btn => btn.addEventListener("click", () => printDoc("set", btn.dataset.printSet)));
  document.querySelectorAll("[data-print-supplier-statement]").forEach(btn => btn.addEventListener("click", () => printDoc("supplier-statement", btn.dataset.printSupplierStatement)));
  document.querySelectorAll("[data-print-buyer-statement]").forEach(btn => btn.addEventListener("click", () => printDoc("buyer-statement", btn.dataset.printBuyerStatement)));
  
  // Master Settlement Selection UI
  document.querySelectorAll("[data-show-supplier-master-deals]").forEach(btn => btn.addEventListener("click", () => {
    const id = btn.dataset.showSupplierMasterDeals;
    const wrap = document.getElementById(`supplier-master-deals-wrap-${id}`);
    if (wrap) wrap.style.display = wrap.style.display === "none" ? "block" : "none";
  }));
  document.querySelectorAll("[data-show-buyer-master-deals]").forEach(btn => btn.addEventListener("click", () => {
    const id = btn.dataset.showBuyerMasterDeals;
    const wrap = document.getElementById(`buyer-master-deals-wrap-${id}`);
    if (wrap) wrap.style.display = wrap.style.display === "none" ? "block" : "none";
  }));

  // Master Settlement Print Handlers
  document.querySelectorAll("[data-print-supplier-master-selected]").forEach(btn => btn.addEventListener("click", () => {
    const supplierId = btn.dataset.printSupplierMasterSelected;
    const selectedIds = Array.from(document.querySelectorAll(`input[name="master_deal_ids_${supplierId}"]:checked`)).map(cb => cb.value);
    if (!selectedIds.length) return alert("Please select at least one deal.");
    printMasterStatement("supplier", supplierId, selectedIds);
  }));
  document.querySelectorAll("[data-print-buyer-master-selected]").forEach(btn => btn.addEventListener("click", () => {
    const buyerId = btn.dataset.printBuyerMasterSelected;
    const selectedIds = Array.from(document.querySelectorAll(`input[name="master_deal_ids_${buyerId}"]:checked`)).map(cb => cb.value);
    if (!selectedIds.length) return alert("Please select at least one deal.");
    printMasterStatement("buyer", buyerId, selectedIds);
  }));

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
 * DASHBOARD BREAKDOWN LOGIC
 */
function bindDashboardUI() {
  const modal = document.getElementById("working-modal");
  const title = document.getElementById("working-title");
  const body = document.getElementById("working-body");
  const closeBtn = document.getElementById("close-working-modal");

  const fmt = (val) => Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  document.querySelectorAll(".working-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.breakdown;
      const data = state._lastDashboardBreakdown[type] || [];
      
      let html = "";
      if (type === "receivables") {
        title.innerText = "Receivables Breakdown (AED)";
        html = `
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>Deal No</th>
                <th>Sale (USD)</th>
                <th>Received (USD)</th>
                <th>Balance (USD)</th>
                <th>Conv</th>
                <th>Balance (AED)</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(item => `
                <tr>
                  <td style="font-weight:700">${esc(item.deal_no)}</td>
                  <td>${fmt(item.total_usd)}</td>
                  <td style="color:var(--success)">${fmt(item.received_usd)}</td>
                  <td style="font-weight:700">${fmt(item.balance_usd)}</td>
                  <td style="color:var(--text-dim)">${item.conv}</td>
                  <td style="font-weight:800; color:var(--success)">${fmt(item.balance_aed)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="formula-box">
            <strong>Formula:</strong> (Sale Amount USD - Received Payments USD) × Conversion Rate = <strong>Receivable AED</strong>
          </div>
        `;
      } else if (type === "payables") {
        title.innerText = "Payables Breakdown (AED)";
        html = `
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>Deal No</th>
                <th>Purchase (USD)</th>
                <th>Sent (USD)</th>
                <th>Balance (USD)</th>
                <th>Conv</th>
                <th>Balance (AED)</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(item => `
                <tr>
                  <td style="font-weight:700">${esc(item.deal_no)}</td>
                  <td>${fmt(item.total_usd)}</td>
                  <td style="color:var(--danger)">${fmt(item.sent_usd)}</td>
                  <td style="font-weight:700">${fmt(item.balance_usd)}</td>
                  <td style="color:var(--text-dim)">${item.conv}</td>
                  <td style="font-weight:800; color:var(--danger)">${fmt(item.balance_aed)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="formula-box">
            <strong>Formula:</strong> (Purchase Amount USD - Sent Payments USD) × Conversion Rate = <strong>Payable AED</strong>
            <br><br>
            <span style="color:var(--danger)">* If Balance is <strong>MINUS</strong>, it means you have paid MORE than the recorded Purchase Amount for that deal.</span>
          </div>
        `;
      } else if (type === "profit") {
        title.innerText = "Expected Profit Breakdown (AED)";
        html = `
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>Deal No</th>
                <th>Total Sale (AED)</th>
                <th>Total Purchase (AED)</th>
                <th>Expected Profit (AED)</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(item => `
                <tr>
                  <td style="font-weight:700">${esc(item.deal_no)}</td>
                  <td style="color:var(--success)">${fmt(item.sale_aed)}</td>
                  <td style="color:var(--danger)">${fmt(item.purchase_aed)}</td>
                  <td style="font-weight:800; color:var(--primary)">${fmt(item.profit_aed)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="formula-box">
            <strong>Formula:</strong> Total Sale AED - Total Purchase AED = <strong>Expected Profit AED</strong>
          </div>
        `;
      }

      body.innerHTML = html || "<div class='empty'>No data available</div>";
      modal.style.display = "flex";
    });
  });

  closeBtn?.addEventListener("click", () => {
    modal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
}

/**
 * ROBUST HANDLERS
 */

function validateDeal(fd) {
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
  const name = String(fd.get("name") || "").trim().toUpperCase();
  const hsn = String(fd.get("hsn_code") || "").trim().toUpperCase();

  // Duplicate Check
  const exists = state.products.some(p => 
    String(p.name || "").trim().toUpperCase() === name && 
    String(p.hsn_code || "").trim().toUpperCase() === hsn
  );

  if (exists) {
    return alert("Error: A product with this name and HSN code already exists.");
  }

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
  const name = String(fd.get("name") || "").trim().toUpperCase();
  const hsn = String(fd.get("hsn_code") || "").trim().toUpperCase();

  // Duplicate Check (excluding itself)
  const exists = state.products.some(p => 
    String(p.id) !== String(id) &&
    String(p.name || "").trim().toUpperCase() === name && 
    String(p.hsn_code || "").trim().toUpperCase() === hsn
  );

  if (exists) {
    return alert("Error: Another product with this same name and HSN code already exists.");
  }

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
          <option value="Commission">Commission</option>
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
    converted_amount: Number(convertedAmount.toFixed(2)), // Ensure it's a number and rounded
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
              <input id="pe-converted-${paymentId}" type="text" readonly value="${(p.converted_amount !== null && p.converted_amount !== undefined ? p.converted_amount : p.amount).toFixed(2)}" style="background:transparent; border:none">
            </div>
          </div>
        </div>

        <select name="method" id="pe-method-${paymentId}">
          <option value="Bank" ${p.method === "Bank" ? "selected" : ""}>Bank</option>
          <option value="Token" ${p.method === "Token" ? "selected" : ""}>Token</option>
          <option value="Commission" ${p.method === "Commission" ? "selected" : ""}>Commission</option>
          <option value="Other" ${!["Bank","Token","Commission"].includes(p.method) ? "selected" : ""}>Other</option>
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

function showHighSeasForm(id) {
  const d = state.deals.find(x => String(x.id) === String(id));
  const wrap = document.getElementById(`high-seas-form-wrap-${id}`);
  if (!d || !wrap) return;
  wrap.innerHTML = highSeasFormHtml(d);
  document.getElementById(`high-seas-form-${id}`).addEventListener("submit", (e) => saveHighSeasDetail(e, id));
  document.getElementById(`cancel-high-seas-${id}`).addEventListener("click", () => wrap.innerHTML = "");
}

async function saveHighSeasDetail(e, id) {
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

function bindDealAutoTotal(id = null) {
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

  // 1. Always save AI keys to local storage as fallback
  if (payload.gemini_api_key) localStorage.setItem("gemini_api_key", payload.gemini_api_key);
  if (payload.gemini_model) localStorage.setItem("gemini_model", payload.gemini_model);

  // 2. Try to save to Supabase
  let { error } = await supabase.from("company_settings").update(payload).eq("id", 1);
  
  // 3. Robust fallback if columns are missing
  if (error && (error.message.includes("gemini_model") || error.message.includes("gemini_api_key"))) {
    console.warn("AI setting columns missing in DB, retrying with basic settings only.");
    const minimalPayload = { ...payload };
    delete minimalPayload.gemini_model;
    delete minimalPayload.gemini_api_key;
    
    const retry = await supabase.from("company_settings").update(minimalPayload).eq("id", 1);
    error = retry.error;
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

  // Edit and Delete handlers
  document.querySelectorAll("[data-edit-si]").forEach(btn => {
    btn.addEventListener("click", () => editShippingInstruction(btn.dataset.editSi));
  });

  document.getElementById("si-cancel-btn")?.addEventListener("click", () => {
    form.reset();
    document.getElementById("si-id").value = "";
    document.getElementById("si-save-btn").textContent = "Save";
    document.getElementById("si-cancel-btn").style.display = "none";
  });
}

function editShippingInstruction(id) {
  const si = state.shippingInstructions.find(x => String(x.id) === String(id));
  if (!si) return;

  document.getElementById("si-id").value = si.id;
  document.getElementById("si-shipper").value = si.shipper_index ?? "";
  document.getElementById("si-buyer").value = si.buyer_id ?? "";
  document.getElementById("si-deal").value = si.deal_id ?? "";
  document.getElementById("si-supplier").value = si.supplier_id ?? "";
  document.getElementById("si-product").value = si.product || "";
  document.getElementById("si-hsn").value = si.hsn_code || "";
  document.getElementById("si-free-days").value = si.free_days_text || "";
  document.getElementById("si-detention").value = si.detention_text || "";
  document.getElementById("si-other").value = si.other_instructions || "";

  document.getElementById("si-save-btn").textContent = "Update";
  document.getElementById("si-cancel-btn").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveShippingInstruction(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = fd.get("id");
  const getVal = (k) => {
    const v = fd.get(k);
    return v && v.trim() !== "" ? parseInt(v, 10) : null;
  };

  const payload = {
    shipper_index: getVal("shipper_index"),
    buyer_id: getVal("buyer_id"),
    deal_id: getVal("deal_id"),
    supplier_id: getVal("supplier_id"),
    product: fd.get("product"),
    hsn_code: fd.get("hsn_code"),
    free_days_text: fd.get("free_days_text"),
    detention_text: fd.get("detention_text"),
    other_instructions: fd.get("other_instructions")
  };

  if (id) {
    const { error } = await supabase.from("shipping_instructions").update(payload).eq("id", id);
    if (error) alert(error.message);
    else {
      alert("Updated!");
      await loadSupabaseData();
    }
  } else {
    const { error } = await supabase.from("shipping_instructions").insert(payload);
    if (error) alert(error.message);
    else {
      alert("Saved!");
      await loadSupabaseData();
    }
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

async function saveSupplierDocument(e) {
  e.preventDefault();
  const supplierId = e.target.getAttribute("data-supplier-doc-upload");
  const fd = new FormData(e.target);
  const file = fd.get("file");
  const docType = fd.get("docType");
  const expiryDate = fd.get("expiryDate");
  
  if (!file || file.size === 0) return alert("Please select a file.");
  
  const fileExt = file.name.split('.').pop();
  const fileName = `supplier_${supplierId}_${Date.now()}.${fileExt}`;
  const filePath = `suppliers/${supplierId}/${fileName}`;
  
  const btn = e.target.querySelector("button");
  const originalText = btn.textContent;
  btn.textContent = "Uploading...";
  btn.disabled = true;

  try {
    const { error: uploadError } = await supabase.storage.from("deal-documents").upload(filePath, file);
    if (uploadError) throw uploadError;
    
    const { data: publicUrlData } = supabase.storage.from("deal-documents").getPublicUrl(filePath);
    
    const docPayload = {
      supplier_id: supplierId,
      doc_type: docType,
      file_name: file.name,
      file_url: publicUrlData.publicUrl,
      file_path: filePath,
      mime_type: file.type || "application/octet-stream",
      expiry_date: expiryDate || null
    };
    
    let { error } = await supabase.from("deal_documents").insert(docPayload);
    
    if (error && error.message.includes("expiry_date")) {
      console.warn("expiry_date column missing, retrying without it.");
      delete docPayload.expiry_date;
      const retry = await supabase.from("deal_documents").insert(docPayload);
      error = retry.error;
    }

    if (error) throw error;
    await loadSupabaseData();
    render();
  } catch (err) {
    alert("Upload failed: " + err.message);
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function saveBuyerDocument(e) {
  e.preventDefault();
  const buyerId = e.target.getAttribute("data-buyer-doc-upload");
  const fd = new FormData(e.target);
  const file = fd.get("file");
  const docType = fd.get("docType");
  const expiryDate = fd.get("expiryDate");
  
  if (!file || file.size === 0) return alert("Please select a file.");
  
  const fileExt = file.name.split('.').pop();
  const fileName = `buyer_${buyerId}_${Date.now()}.${fileExt}`;
  const filePath = `buyers/${buyerId}/${fileName}`;
  
  const btn = e.target.querySelector("button");
  const originalText = btn.textContent;
  btn.textContent = "Uploading...";
  btn.disabled = true;

  try {
    const { error: uploadError } = await supabase.storage.from("deal-documents").upload(filePath, file);
    if (uploadError) throw uploadError;
    
    const { data: publicUrlData } = supabase.storage.from("deal-documents").getPublicUrl(filePath);
    
    const docPayload = {
      buyer_id: buyerId,
      doc_type: docType,
      file_name: file.name,
      file_url: publicUrlData.publicUrl,
      file_path: filePath,
      mime_type: file.type || "application/octet-stream",
      expiry_date: expiryDate || null
    };
    
    let { error } = await supabase.from("deal_documents").insert(docPayload);
    
    if (error && error.message.includes("expiry_date")) {
      console.warn("expiry_date column missing, retrying without it.");
      delete docPayload.expiry_date;
      const retry = await supabase.from("deal_documents").insert(docPayload);
      error = retry.error;
    }

    if (error) throw error;
    await loadSupabaseData();
    render();
  } catch (err) {
    alert("Upload failed: " + err.message);
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function saveCompanyDocument(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const file = fd.get("file");
  const docType = fd.get("docType");
  const expiryDate = fd.get("expiryDate");
  
  if (!file || file.size === 0) return alert("Please select a file.");
  
  const fileExt = file.name.split('.').pop();
  const fileName = `company_${Date.now()}.${fileExt}`;
  const filePath = `company/${fileName}`;
  
  const btn = e.target.querySelector("button");
  const originalText = btn.textContent;
  btn.textContent = "Uploading...";
  btn.disabled = true;

  try {
    const { error: uploadError } = await supabase.storage.from("deal-documents").upload(filePath, file);
    if (uploadError) throw uploadError;
    
    const { data: publicUrlData } = supabase.storage.from("deal-documents").getPublicUrl(filePath);
    
    const docPayload = {
      doc_type: docType,
      file_name: file.name,
      file_url: publicUrlData.publicUrl,
      file_path: filePath,
      mime_type: file.type || "application/octet-stream",
      expiry_date: expiryDate || null
    };
    
    let { error } = await supabase.from("deal_documents").insert(docPayload);
    
    if (error && error.message.includes("expiry_date")) {
      console.warn("expiry_date column missing, retrying without it.");
      delete docPayload.expiry_date;
      const retry = await supabase.from("deal_documents").insert(docPayload);
      error = retry.error;
    }

    if (error) throw error;
    await loadSupabaseData();
    render();
  } catch (err) {
    alert("Upload failed: " + err.message);
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function deleteBuyerDocument(val) {
  const [buyerId, docId] = val.split(":");
  if (confirm("Delete this buyer document?")) {
    const { error } = await supabase.from("deal_documents").update({ is_deleted: true }).eq("id", docId);
    if (error) alert(error.message);
    else {
      await loadSupabaseData();
      render();
    }
  }
}

async function deleteCompanyDocument(docId) {
  if (confirm("Delete this company document?")) {
    const { error } = await supabase.from("deal_documents").update({ is_deleted: true }).eq("id", docId);
    if (error) alert(error.message);
    else {
      await loadSupabaseData();
      render();
    }
  }
}

function shareDocViaWhatsapp(docId) {
  const doc = Object.values(state.documentsByDeal).flat()
    .concat(Object.values(state.documentsBySupplier).flat())
    .concat(Object.values(state.documentsByBuyer).flat())
    .concat(state.documentsByCompany)
    .find(d => String(d.id) === String(docId));
    
  if (!doc) return alert("Document not found.");
  
  const text = `*Shared Document*\n\n*Type:* ${doc.doc_type || "Document"}\n*File:* ${doc.file_name}\n${doc.expiry_date ? `*Expiry:* ${doc.expiry_date}\n` : ""}*Link:* ${doc.file_url}\n\nGenerated via JK Trade Manager`;
  
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

async function deleteSupplierDocument(val) {
  const [supplierId, docId] = val.split(":");
  if (confirm("Delete this supplier document?")) {
    const { error } = await supabase.from("deal_documents").update({ is_deleted: true }).eq("id", docId);
    if (error) alert(error.message);
    else {
      await loadSupabaseData();
      render();
    }
  }
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
    "Port of Loading", "Port of Discharge", "Country of Origin", "Vessel", "ETA", "Shipment Out", "Payment Terms",
    "BL No", "No of Containers", "Package Details", "Loaded On", "Invoice Date",
    "CI No", "PL No", "COO No"
  ];

  const rows = state.deals.map(d => {
    const buyer = getBuyerById(d.buyer_id)?.name || "—";
    const supplier = state.suppliers.find(s => String(s.id) === String(d.supplier_id))?.name || "—";
    
    const isUsd = d.document_currency === "USD";
    const s = paymentSummary(
      d.id, 
      isUsd ? d.total_amount_usd : d.total_amount_aed,
      isUsd ? d.purchase_total_usd : d.purchase_total_aed,
      isUsd ? "USD" : "AED"
    );

    const containerCount = Array.isArray(d.container_numbers) ? d.container_numbers.length : 0;
    
    const data = [
      d.deal_no, d.type, d.status, d.approval_status,
      supplier, d.purchase_rate, d.purchase_total_usd, d.purchase_total_aed, s.sent, s.payable,
      buyer, d.rate, d.total_amount_usd, d.total_amount_aed, s.received, s.receivable,
      d.product_name, d.hsn_code, d.quantity, d.unit,
      d.base_currency, d.document_currency, d.conversion_rate,
      d.loading_port || "—", d.discharge_port || "—", d.country_of_origin || "—", d.vessel_voyage || d.vessel, d.eta, d.shipment_out_date, d.payment_terms,
      d.bl_no || "—", containerCount, d.package_details || "—", d.loaded_on || "—", d.invoice_date || "—",
      d.ci_no || "—", d.pl_no || "—", d.coo_no || "—"
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
  if (!deal) return;
  
  if (type === "coa") {
    // COA is handled via showCOAForm
    return;
  }

  const buyer = getBuyerById(deal?.buyer_id);
  const supplier = state.suppliers.find(s => String(s.id) === String(deal?.supplier_id));

  const buyerDeals = state.deals
    .filter(d => String(d.buyer_id) === String(deal.buyer_id))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const dealCount = buyerDeals.findIndex(d => String(d.id) === String(deal.id)) + 1;

    const docRate = deal.document_currency === "USD" 
      ? (deal.sale_invoice_rate ? deal.sale_invoice_rate_usd : deal.rate_usd)
      : (deal.sale_invoice_rate ? deal.sale_invoice_rate_aed : deal.rate_aed);

    const docPurchaseRate = deal.document_currency === "USD"
      ? (deal.purchase_invoice_rate ? deal.purchase_invoice_rate_usd : (deal.purchase_rate_usd || deal.purchase_rate))
      : (deal.purchase_invoice_rate ? deal.purchase_invoice_rate_aed : (deal.purchase_rate_aed || deal.purchase_rate));

    const totalAmount = deal.quantity * docRate;

    const dealDoc = { 
      ...deal, 
      dealNo: deal.deal_no, 
      productName: deal.product_name, 
      totalAmount: totalAmount,
      docRate: docRate,
      docPurchaseRate: docPurchaseRate,
      dealCount: dealCount
    };
  const payments = paymentsForDeal(dealId);

  // Map selected bank
  const bankIdx = parseInt(deal.document_bank_index || 0);
  const bank = (state.company.bankAccounts || [])[bankIdx] || {};

  // Map selected shipper
  const shipperIdx = deal.shipper_index !== null && deal.shipper_index !== "" ? parseInt(deal.shipper_index) : -1;
  const shipper = shipperIdx >= 0 ? (state.company.shippers || [])[shipperIdx] : null;

  const companyForDoc = {
    ...state.company,
    name: shipper ? shipper.name : state.company.name,
    address: shipper ? shipper.address : state.company.address,
    bankAccount: bank.account || "",
    bankIBAN: bank.iban || "",
    bankSWIFT: bank.swift || "",
    bankName: bank.bankName || ""
  };

  let html = "";
  if (type === "pi") html = buildPI(dealDoc, buyer, supplier, companyForDoc);
  if (type === "ci") html = buildCI(dealDoc, buyer, supplier, companyForDoc);
  if (type === "pl") html = buildPL(dealDoc, buyer, supplier, companyForDoc);
  if (type === "coo") html = buildCOO(dealDoc, buyer, supplier, companyForDoc);
  if (type === "set") html = buildDocumentSet(dealDoc, buyer, supplier, companyForDoc);
  if (type === "supplier-statement") html = buildSupplierStatement(deal, buyer, supplier, payments, companyForDoc);
  if (type === "buyer-statement") html = buildBuyerStatement(deal, buyer, supplier, payments, companyForDoc);
  
  if (html) openPrintWindow(html);
}

function printMasterStatement(entityType, id, selectedDealIds = []) {
  const company = state.company;
  let html = "";
  
  if (entityType === "supplier") {
    const supplier = state.suppliers.find(s => String(s.id) === String(id));
    if (!supplier) return;
    const deals = state.deals.filter(d => selectedDealIds.includes(String(d.id)));
    const allPayments = Object.values(state.paymentsByDeal).flat().filter(p => selectedDealIds.includes(String(p.deal_id)));
    html = buildSupplierMasterStatement(supplier, deals, allPayments, company);
  } else {
    const buyer = state.buyers.find(b => String(b.id) === String(id));
    if (!buyer) return;
    const deals = state.deals.filter(d => selectedDealIds.includes(String(d.id)));
    const allPayments = Object.values(state.paymentsByDeal).flat().filter(p => selectedDealIds.includes(String(p.deal_id)));
    html = buildBuyerMasterStatement(buyer, deals, allPayments, company);
  }

  if (html) openPrintWindow(html);
}

async function runExpiryScan(docId) {
  const key = state.company.gemini_api_key;
  if (!key) return alert("Please add your Gemini API Key in Settings first.");

  // Flatten all documents to find the one we need
  const doc = Object.values(state.documentsByDeal).flat()
    .concat(Object.values(state.documentsBySupplier).flat())
    .concat(Object.values(state.documentsByBuyer).flat())
    .concat(state.documentsByCompany)
    .find(d => String(d.id) === String(docId));
    
  if (!doc || !doc.file_url) return alert("Document file not found.");

  const btn = document.querySelector(`[data-ai-expiry-scan="${docId}"]`);
  const originalText = btn?.textContent || "AI";
  if (btn) {
    btn.textContent = "⌛";
    btn.disabled = true;
  }

  try {
    const response = await fetch(doc.file_url);
    const blob = await response.blob();
    const reader = new FileReader();
    const base64 = await new Promise((resolve) => {
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });

    const model = state.company.gemini_model || "gemini-2.5-flash";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const prompt = `Analyze this document and extract the EXPIRY DATE or RENEWAL DATE. 
    Look for keywords like 'Expiry', 'Valid Until', 'Expires', 'Date of Expiry'.
    Return ONLY a JSON object with the field 'expiry_date' in YYYY-MM-DD format. If not found, return {"expiry_date": null}.`;
    
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
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI could not read the document.");
    
    const jsonStr = text.replace(/```json|```/g, "").trim();
    const data = JSON.parse(jsonStr);

    if (data.expiry_date) {
      if (confirm(`AI found Expiry Date: ${data.expiry_date}. Update document?`)) {
        const { error } = await supabase.from("deal_documents").update({ expiry_date: data.expiry_date }).eq("id", docId);
        if (error) {
          if (error.message.includes("expiry_date")) {
            alert(`AI found the date (${data.expiry_date}), but it could not be saved because the 'expiry_date' column is missing from your database. Please update your database schema.`);
          } else {
            throw error;
          }
        } else {
          alert("Expiry date updated!");
          await loadSupabaseData();
          render();
        }
      }
    } else {
      alert("AI could not find an expiry date on this document.");
    }
  } catch (err) {
    alert("Scan failed: " + err.message);
  } finally {
    if (btn) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }
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
    - quantity: Total quantity/weight of the main product as shown on the document (number only).
    - unit: The unit of the quantity as shown on the document (e.g., MTON, KGS, LBS).
    - hsn_code: HSN or HS Code if mentioned.
    - gross_weight: Total Gross Weight (number only).
    - net_weight: Total Net Weight (number only).
    - package_details: Details about packages (e.g. 20FT X 10 CONTAINERS).
    - loaded_on: What the goods are loaded on (e.g. ISO TANK, FLEXI TANK).
    - container_numbers: A list/array of all container numbers mentioned (e.g. ["MSCU1234567", "MSCU7654321"]). Look in the 'Container No.' or 'Marks & Nos' section.
    - shipment_out_date: Date of shipment or 'Shipped on Board' date (YYYY-MM-DD).
    - country_of_origin: Country of origin if mentioned.
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
    const cleanContainers = cleanContainerNumbers(data.container_numbers);
    const containerCount = cleanContainers.length;
    
    const summary = [
      `BL No: ${data.bl_no || "—"}`,
      `Vessel/Voyage: ${data.vessel || "—"}${data.voyage_no ? ` / ${data.voyage_no}` : ""}`,
      `Port: ${data.loading_port || "—"} -> ${data.discharge_port || "—"}`,
      `Origin: ${data.country_of_origin || "—"}`,
      `Product: ${data.product_name || "—"}`,
      `Qty: ${data.quantity || "—"} ${data.unit || ""}`,
      `HSN: ${data.hsn_code || "—"}`,
      `Pkg: ${data.package_details || "—"} | Loaded: ${data.loaded_on || "—"}`,
      `Weights: G:${data.gross_weight || "—"} / N:${data.net_weight || "—"}`,
      `Containers (${containerCount}): ${containerCount > 0 ? cleanContainers.slice(0, 3).join(", ") + (containerCount > 3 ? "..." : "") : "None found"}`
    ].join("\n");

    if (confirm(`AI found the following details:\n\n${summary}\n\nApply these changes?`)) {
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
      
      // Weight and Unit logic:
      let qty = data.quantity ? Number(data.quantity) : null;
      let net = data.net_weight ? Number(data.net_weight) : null;
      let scanUnit = String(data.unit || "").trim().toUpperCase();
      
      const currentDeal = state.deals.find(x => String(x.id) === String(dealId));
      const dealUnit = (currentDeal?.unit || "MTON").toUpperCase();
      
      // Smart conversion if document unit differs from deal unit
      if (qty && scanUnit && dealUnit === "MTON") {
        if (scanUnit === "KGS" || scanUnit === "KG") {
          qty = Number((qty / 1000).toFixed(3));
        } else if (scanUnit === "LBS" || scanUnit === "LB") {
          qty = Number((qty * 0.000453592).toFixed(3));
        }
      }
      
      // Fallback heuristic if scanUnit is missing
      if (qty && !scanUnit && dealUnit === "MTON" && qty > 200) {
        qty = Number((qty / 1000).toFixed(3));
      }
      
      // If quantity is missing but net_weight is present, calculate it
      if (!qty && net) {
        qty = (dealUnit === "MTON" && net > 200) ? Number((net / 1000).toFixed(3)) : net;
      }
      
      if (qty) updateData.quantity = qty;
      if (data.gross_weight) updateData.gross_weight = Number(data.gross_weight);
      if (net) updateData.net_weight = net;
      
      if (data.container_numbers) {
        updateData.container_numbers = data.container_numbers.map(c => 
          String(c).replace(/[^A-Z0-9]/gi, "").toUpperCase()
        );
      }
      if (data.shipment_out_date) updateData.shipment_out_date = data.shipment_out_date;
      if (data.country_of_origin) updateData.country_of_origin = String(data.country_of_origin).trim().toUpperCase();
      if (data.hsn_code) updateData.hsn_code = String(data.hsn_code).replace(/[^A-Z0-9]/gi, "").toUpperCase();
      if (data.unit) updateData.unit = String(data.unit).trim().toUpperCase();
      if (data.package_details) updateData.package_details = String(data.package_details).trim().toUpperCase();
      if (data.loaded_on) updateData.loaded_on = String(data.loaded_on).trim().toUpperCase();
      if (data.eta) updateData.eta = data.eta;

      // Check if the Edit Form is open for this deal
      const editForm = document.getElementById(`deal-edit-form-${dealId}`);
      if (editForm) {
        console.log("Found open edit form, populating fields...");
        Object.entries(updateData).forEach(([key, val]) => {
          const input = editForm.querySelector(`[name="${key}"]`);
          if (input) {
            if (key === "container_numbers" && Array.isArray(val)) {
              input.value = val.join("\n");
            } else {
              input.value = val;
            }
            // CRITICAL: Dispatch input event to trigger auto-calculations
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
        alert("Form populated with AI data! Please review and click 'Update Deal' to save.");
      } else {
        // Form not open, update Supabase directly
        const { error } = await supabase.from("deals").update(updateData).eq("id", dealId);
        if (error) throw error;
        alert("Deal updated successfully!");
        await loadSupabaseData();
        render();
      }
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

/**
 * AGENTS
 */
function showAgentForm() {
  const wrap = document.getElementById("agent-form-wrap");
  if (wrap) wrap.innerHTML = agentFormHtml();
  bindUI();
}

function showEditAgentForm(id) {
  const a = state.agents.find(x => String(x.id) === String(id));
  const wrap = document.getElementById(`agent-edit-wrap-${id}`);
  if (wrap) wrap.innerHTML = agentFormHtml(a, true, id);
  
  document.getElementById(`cancel-agent-edit-${id}`)?.addEventListener("click", () => {
    wrap.innerHTML = "";
  });
  
  document.getElementById(`agent-edit-form-${id}`)?.addEventListener("submit", (e) => saveAgent(e, id));
}

async function saveAgent(e, editId = null) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd);
  
  try {
    if (editId) {
      const { error } = await supabase.from("commission_agents").update(data).eq("id", editId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("commission_agents").insert([data]);
      if (error) throw error;
    }
    await loadSupabaseData();
  } catch (err) {
    alert("Save Agent failed: " + err.message);
  }
}

async function deleteAgent(id) {
  if (!confirm("Are you sure you want to delete this agent?")) return;
  try {
    const { error } = await supabase.from("commission_agents").delete().eq("id", id);
    if (error) throw error;
    await loadSupabaseData();
  } catch (err) {
    alert("Delete Agent failed: " + err.message);
  }
}

function printAgentStatement(agentId, selectedIds = null) {
  const agent = state.agents.find(a => String(a.id) === String(agentId));
  if (!agent) return alert("Agent not found.");
  
  let agentDeals = state.deals.filter(d => 
    d.commission_name && d.commission_name.toLowerCase().includes(agent.name.toLowerCase())
  );
  
  if (selectedIds) {
    agentDeals = agentDeals.filter(d => selectedIds.includes(String(d.id)));
  }
  
  if (!agentDeals.length && !(state.agentPaymentsByAgent[agentId] || []).length) return alert("No commission deals or payments found for this agent.");
  
  const html = buildAgentStatement(agent, agentDeals, state.company, state.agentPaymentsByAgent[agentId] || []);
  openPrintWindow(html);
}

/**
 * AGENT PAYMENTS
 */
function showAgentPaymentForm(agentId) {
  const wrap = document.getElementById(`agent-payment-form-inner-${agentId}`);
  if (wrap) wrap.innerHTML = agentPaymentFormHtml(agentId);
  
  document.getElementById("cancel-agent-payment-form")?.addEventListener("click", () => {
    wrap.innerHTML = "";
  });
  
  document.getElementById("agent-payment-form")?.addEventListener("submit", (e) => saveAgentPayment(e));
}

function showEditAgentPaymentForm(agentId, paymentId) {
  const p = (state.agentPaymentsByAgent[agentId] || []).find(x => String(x.id) === String(paymentId));
  const wrap = document.getElementById(`agent-payment-form-inner-${agentId}`);
  if (wrap) wrap.innerHTML = agentPaymentFormHtml(agentId, p, true, paymentId);
  
  document.getElementById(`cancel-agent-payment-edit-${paymentId}`)?.addEventListener("click", () => {
    wrap.innerHTML = "";
  });
  
  document.getElementById(`agent-payment-edit-form-${paymentId}`)?.addEventListener("submit", (e) => saveAgentPayment(e, paymentId));
}

async function saveAgentPayment(e, editId = null) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd);
  
  try {
    if (editId) {
      const { error } = await supabase.from("agent_payments").update(data).eq("id", editId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("agent_payments").insert([data]);
      if (error) throw error;
    }
    await loadSupabaseData();
  } catch (err) {
    alert("Save Agent Payment failed: " + err.message);
  }
}

async function deleteAgentPayment(id) {
  if (!confirm("Are you sure?")) return;
  try {
    const { error } = await supabase.from("agent_payments").delete().eq("id", id);
    if (error) throw error;
    await loadSupabaseData();
  } catch (err) {
    alert("Delete Agent Payment failed: " + err.message);
  }
}

/**
 * TRACKING
 */
function trackDeal(id) {
  const d = state.deals.find(x => String(x.id) === String(id));
  if (!d) return;
  const num = d.bl_no || (d.container_numbers && d.container_numbers[0]);
  if (!num) return alert("No BL or Container number found for this deal.");
  
  // Default to Google search for the number
  const url = `https://www.google.com/search?q=track+shipment+${num}`;
  window.open(url, "_blank");
}

async function saveTrackingLog(id) {
  const val = document.getElementById(`tracking-input-${id}`)?.value;
  try {
    const { error } = await supabase.from("deals").update({
      tracking_status: val,
      tracking_updated_at: new Date().toISOString()
    }).eq("id", id);
    if (error) throw error;
    await loadSupabaseData();
  } catch (err) {
    alert("Save Tracking Log failed: " + err.message);
  }
}

/**
 * COA FORM
 */
function showCOAForm(dealId) {
  console.log("Showing COA Form for deal:", dealId);
  const d = getDealById(dealId);
  if (!d) {
    console.error("Deal not found for ID:", dealId);
    return alert("Error: Deal not found.");
  }

  const modal = document.createElement("div");
  modal.id = "coa-modal";
  modal.className = "modal"; // Using standard modal class from style.css
  modal.style.display = "flex"; // Force visibility
  modal.style.zIndex = "10000";
  
  const today = new Date().toISOString().split("T")[0];
  const prodName = d.product_name || "MATERIAL";
  const shortGrade = prodName.substring(0,2).toUpperCase();
  const certNo = `COA/${shortGrade}/${d.bl_no || "BL"}/${today.replace(/-/g,"").slice(2)}`;

  // Expanded default tests from user images
  const defaultTests = [
    { parameter: "Flash Point", method: "ASTM D-92", unit: "°C", result: "" },
    { parameter: "Density @ 15°C", method: "ASTM D-4052", unit: "g/cm³", result: "" },
    { parameter: "Kinematic Viscosity @ 40°C", method: "ASTM D-445", unit: "Cst", result: "" },
    { parameter: "Kinematic Viscosity @ 100°C", method: "ASTM D-445", unit: "Cst", result: "" },
    { parameter: "Viscosity Index", method: "ASTM D-2270", unit: "", result: "" },
    { parameter: "Ash content", method: "", unit: "%", result: "" },
    { parameter: "Color", method: "ASTM D-1500", unit: "", result: "" },
    { parameter: "Water Solubility", method: "", unit: "", result: "" },
    { parameter: "Pour Point", method: "", unit: "°C", result: "" },
    { parameter: "Base oil - highly refined", method: "", unit: "", result: "" },
    { parameter: "Distillation", method: "", unit: "", result: "", isHeader: true },
    { parameter: "IBP", method: "ASTM D-86", unit: "°C", result: "" },
    { parameter: "50% Recovered", method: "ASTM D-86", unit: "°C", result: "" },
    { parameter: "FBP", method: "ASTM D-86", unit: "°C", result: "" }
  ];

  // Logic to find the best data to pre-fill
  let saved = d.coa_data || null;
  
  // If no data saved for THIS deal, look for the most recent deal with the SAME product name
  if (!saved) {
    const similarDeal = state.deals
      .filter(other => other.id !== dealId && other.product_name === d.product_name && other.coa_data)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    
    if (similarDeal) {
      console.log("Using COA template from similar deal:", similarDeal.deal_no);
      saved = { ...similarDeal.coa_data };
      // IMPORTANT: We ONLY want the tests. We clear the deal-specific fields.
      delete saved.date;
      delete saved.cert_no;
      delete saved.bl_no;
    }
  }

  const testsToUse = (saved && saved.tests) ? saved.tests : defaultTests;
  const dateToUse = (saved && saved.date) ? saved.date : today;
  const certNoToUse = (saved && saved.cert_no) ? saved.cert_no : certNo;
  const blNoToUse = (saved && saved.bl_no) ? saved.bl_no : (d.bl_no || "");
  const gradeToUse = (saved && saved.grade) ? saved.grade : prodName;

  modal.innerHTML = `
    <div class="modal-content" style="max-width:800px; padding:30px; max-height:90vh; overflow-y:auto">
      <div class="title" style="margin-bottom:10px">Prepare Certificate of Analysis</div>
      <p class="item-sub">Fill in the details for the test report. Rows with no "Result" will be ignored in the printout. <b>Results are automatically saved to the deal.</b></p>
      
      <form id="coa-generation-form">
        <div class="grid grid-2 gap-10 mt-12">
          <div>
            <label class="form-label">Date</label>
            <input type="date" name="date" value="${dateToUse}" required>
          </div>
          <div>
            <label class="form-label">Certificate No.</label>
            <input type="text" name="cert_no" value="${esc(certNoToUse)}" required>
          </div>
          <div>
            <label class="form-label">BL No.</label>
            <input type="text" name="bl_no" value="${esc(blNoToUse)}" required>
          </div>
          <div>
            <label class="form-label">Grade / Description</label>
            <input type="text" name="grade" value="${esc(gradeToUse)}" required>
          </div>
        </div>

        <div class="mt-20">
          <div class="flex flex-between flex-center">
            <div class="item-title">Test Parameters</div>
            <button type="button" id="add-coa-row" class="btn-small">Add Row</button>
          </div>
          <table class="table mt-10" id="coa-tests-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Method</th>
                <th>Unit</th>
                <th>Result</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${testsToUse.map((t, idx) => `
                <tr class="coa-test-row" data-header="${t.isHeader ? '1' : '0'}">
                  <td><input name="test_param" value="${esc(t.parameter)}" placeholder="Parameter" ${t.isHeader ? 'style="font-weight:bold; background:rgba(255,255,255,0.05)"' : ''}></td>
                  <td><input name="test_method" value="${esc(t.method)}" placeholder="Method" ${t.isHeader ? 'disabled' : ''}></td>
                  <td><input name="test_unit" value="${esc(t.unit)}" placeholder="Unit" ${t.isHeader ? 'disabled' : ''}></td>
                  <td><input name="test_result" value="${esc(t.result)}" placeholder="Result (Value)" ${t.isHeader ? 'disabled' : ''}></td>
                  <td><button type="button" class="btn-danger btn-small remove-coa-row">×</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <div class="flex gap-10 mt-20">
          <button type="submit" class="btn-primary">Save & Print COA</button>
          <button type="button" id="close-coa-modal">Cancel</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Bind Row Actions
  modal.querySelector("#add-coa-row").addEventListener("click", () => {
    const tbody = modal.querySelector("#coa-tests-table tbody");
    const tr = document.createElement("tr");
    tr.className = "coa-test-row";
    tr.innerHTML = `
      <td><input name="test_param" placeholder="Parameter"></td>
      <td><input name="test_method" placeholder="Method"></td>
      <td><input name="test_unit" placeholder="Unit"></td>
      <td><input name="test_result" placeholder="Result"></td>
      <td><button type="button" class="btn-danger btn-small remove-coa-row">×</button></td>
    `;
    tbody.appendChild(tr);
    tr.querySelector(".remove-coa-row").addEventListener("click", () => tr.remove());
  });

  modal.querySelectorAll(".remove-coa-row").forEach(btn => {
    btn.addEventListener("click", (e) => e.target.closest("tr").remove());
  });

  modal.querySelector("#close-coa-modal").addEventListener("click", () => modal.remove());

  modal.querySelector("#coa-generation-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type='submit']");
    const originalText = btn.textContent;
    btn.textContent = "Saving...";
    btn.disabled = true;

    const fd = new FormData(e.target);
    const coaData = {
      date: fd.get("date"),
      cert_no: fd.get("cert_no"),
      bl_no: fd.get("bl_no"),
      grade: fd.get("grade"),
      tests: []
    };

    const rows = modal.querySelectorAll(".coa-test-row");
    rows.forEach(row => {
      const isHeader = row.dataset.header === "1";
      const param = row.querySelector("[name='test_param']").value;
      const result = row.querySelector("[name='test_result']").value;
      
      // For SAVING, we include everything so it persists
      coaData.tests.push({
        parameter: param,
        method: row.querySelector("[name='test_method']").value,
        unit: row.querySelector("[name='test_unit']").value,
        result: result,
        isHeader: isHeader
      });
    });

    try {
      // Save to Supabase
      const { error } = await supabase.from("deals").update({ coa_data: coaData }).eq("id", dealId);
      if (error) throw error;
      
      // Update local state without full reload if possible, but loadSupabaseData is safer
      await loadSupabaseData();

      // For PRINTING, we filter out empty results
      const printData = {
        ...coaData,
        tests: coaData.tests.filter((t, i, arr) => {
          if (t.isHeader) {
            // Check if there are any results in this section
            let hasResults = false;
            for (let j = i + 1; j < arr.length; j++) {
              if (arr[j].isHeader) break;
              if (arr[j].result && arr[j].result.trim() !== "") {
                hasResults = true;
                break;
              }
            }
            return hasResults;
          }
          return t.result && t.result.trim() !== "";
        })
      };

      const html = buildCOA(printData, d, state.company);
      openPrintWindow(html);
      modal.remove();
    } catch (err) {
      console.error("Save COA Error:", err);
      alert("Failed to save COA data. Please ensure you have run the SQL command to add the 'coa_data' column. Printing will continue anyway.");
      
      // Fallback print
      const printData = { ...coaData, tests: coaData.tests.filter(t => t.isHeader || (t.result && t.result.trim() !== "")) };
      const html = buildCOA(printData, d, state.company);
      openPrintWindow(html);
      modal.remove();
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });
}

// Start
loadSession();