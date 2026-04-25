import { state, getSelectedDeal, paymentsForDeal, documentsForDeal, paymentSummary } from "./state.js";
import { esc, fmtMoney } from "./utils.js";

export function dealDetailView() {
  const d = getSelectedDeal();
  if (!d) return `<div class="card"><div class="title">Deal not found</div></div>`;

  const payments = paymentsForDeal(d.id);
  const docs = documentsForDeal(d.id);
  const s = paymentSummary(d.id, d.total_amount_usd, d.purchase_total_usd);

  return `
    <div class="grid">
      <div class="flex-between flex-center">
        <h2 class="title">DEAL DASHBOARD: ${esc(d.deal_no)}</h2>
        <button id="back-to-deals" class="btn-outline btn-small">BACK</button>
      </div>

      <div class="card">
        <div class="grid grid-2 gap-12">
          <div>
            <div class="stat-label">Product</div>
            <div class="stat-value" style="font-size:18px">${esc(d.product_name)}</div>
          </div>
          <div style="text-align:right">
            <div class="stat-label">Total Amount</div>
            <div class="stat-value" style="font-size:18px">$ ${fmtMoney(d.total_amount_usd)}</div>
          </div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="flex-between mb-12">
            <div class="title">PAYMENTS</div>
            <button data-show-payment-form="${d.id}" class="btn-primary btn-small">+ ADD</button>
          </div>
          <div id="payment-form-wrap-${d.id}"></div>
          <div class="list">
            ${payments.map(p => `
              <div class="item">
                <div class="flex-between">
                  <div class="item-title">${p.currency} ${fmtMoney(p.amount)} (${p.direction.toUpperCase()})</div>
                  <button data-delete-payment="${d.id}:${p.id}" class="btn-danger btn-small">X</button>
                </div>
                <div class="item-sub">${esc(p.payment_date)} · ${esc(p.ref || "")}</div>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="card">
          <div class="flex-between mb-12">
            <div class="title">DOCUMENTS</div>
            <button data-show-document-form="${d.id}" class="btn-primary btn-small">+ ADD</button>
          </div>
          <div id="document-form-wrap-${d.id}"></div>
          <div class="list">
            ${docs.map(doc => `
              <div class="item">
                <div class="flex-between">
                  <div class="item-title">${esc(doc.doc_type)}: ${esc(doc.file_name)}</div>
                  <div class="flex gap-8">
                    <a href="${doc.file_url}" target="_blank" class="btn-info btn-small">VIEW</a>
                    <button data-delete-placeholder-doc="${d.id}:${doc.id}" class="btn-danger btn-small">X</button>
                  </div>
                </div>
                ${doc.doc_type === 'BL' ? `<button data-ai-scan="${d.id}:${doc.id}" class="btn-primary btn-small mt-8 w-full">SCAN WITH AI</button>` : ''}
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="title mb-12">PRINT DOCUMENTS</div>
        <div class="grid grid-4 gap-10">
          <button data-print-pi="${d.id}" class="btn-outline btn-small">PI</button>
          <button data-print-ci="${d.id}" class="btn-outline btn-small">CI</button>
          <button data-print-pl="${d.id}" class="btn-outline btn-small">PL</button>
          <button data-print-coo="${d.id}" class="btn-outline btn-small">COO</button>
        </div>
      </div>
    </div>
  `;
}
