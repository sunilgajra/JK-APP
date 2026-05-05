import { state } from "./state.js";
import { loginView } from "./views.js";
import { dashboardView } from "./dashboard.js";
import { buyersView, showBuyerForm, showEditBuyerForm, deleteBuyer, saveBuyer } from "./buyers.js";
import { suppliersView, showSupplierForm, showEditSupplierForm, deleteSupplier, saveSupplier } from "./suppliers.js";
import { agentsView, showAgentForm, showEditAgentForm, deleteAgent, saveAgent, showAgentPaymentForm, showEditAgentPaymentForm, deleteAgentPayment, printAgentStatement } from "./agents.js";
import { dealsView, showDealForm, showEditDealForm, deleteDeal, showHighSeasForm, exportDealsCsv } from "./deals.js";
import { dealDetailView } from "./dealDetail.js";
import { settingsView, saveCompanySettings, addBankAccount, deleteBankAccount, addShipper, deleteShipper } from "./settings.js";
import { shippingInstructionsView, deleteShippingInstruction } from "./shipping.js";
import { poView, bindPOUI } from "./po.js";
import { productsView, showEditProductForm, deleteProduct, saveProduct } from "./products.js";
import { reportsView, bindReportsUI } from "./reports.js";
import { trackingView, performQuickTrack, trackDeal, saveTrackingLog } from "./tracking.js";
import { loginUser, logoutUser } from "./auth.js";
import { navigate } from "./router.js";
import { showPaymentForm, showEditPaymentForm, deletePayment } from "./payments.js";
import { showDocumentForm, saveDealDocument, deleteDealDocument, saveSupplierDocument, saveBuyerDocument, saveCompanyDocument, deleteSupplierDocument, deleteBuyerDocument, deleteCompanyDocument, shareDocViaWhatsapp, runExpiryScan, showEditDocumentForm, runAiScan } from "./documents.js";
import { checkAiConnection } from "./utils.js"; // Wait, check where checkAiConnection is
import { printDoc, printMasterStatement } from "./documents.js";
import { esc } from "./utils.js";

const content = document.getElementById("content");

let lastFocusedId = null;
let lastSelectionStart = 0;

export function render() {
  console.log("Rendering page:", state.page);
  
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

export function bindUI() {
  console.log("Binding UI for page:", state.page);
  document.getElementById("login-form")?.addEventListener("submit", loginUser);
  document.getElementById("logout-btn")?.addEventListener("click", logoutUser);
  
  if (state.page === "reports") bindReportsUI();
  if (state.page === "po") bindPOUI();
  if (state.page === "dashboard") bindDashboardUI();
  
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

  // Search
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
    // Shared WhatsApp logic... maybe move to utils or stay here?
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

  document.querySelectorAll("[data-delete-supplier-doc]").forEach(btn => btn.addEventListener("click", (e) => deleteSupplierDocument(e.currentTarget.getAttribute("data-delete-supplier-doc"))));
  document.querySelectorAll("[data-delete-buyer-doc]").forEach(btn => btn.addEventListener("click", (e) => deleteBuyerDocument(e.currentTarget.getAttribute("data-delete-buyer-doc"))));
  document.querySelectorAll("[data-delete-company-doc]").forEach(btn => btn.addEventListener("click", (e) => deleteCompanyDocument(e.currentTarget.getAttribute("data-delete-company-doc"))));
  document.querySelectorAll("[data-share-whatsapp-doc]").forEach(btn => btn.addEventListener("click", (e) => shareDocViaWhatsapp(e.currentTarget.getAttribute("data-share-whatsapp-doc"))));
  document.querySelectorAll("[data-ai-expiry-scan]").forEach(btn => btn.addEventListener("click", (e) => runExpiryScan(e.currentTarget.getAttribute("data-ai-expiry-scan"))));

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
  
  // Master Settlement
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

  // Placeholder for others...
}

export function bindDashboardUI() {
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
