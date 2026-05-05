import { state, buyerName, supplierName, paymentSummary, paymentsForDeal, documentsForDeal } from "./state.js";
import { esc, fmtMoney, cleanContainerNumbers } from "./utils.js";

export function dealDetailView() {
  const d = state.dealDetail;
  if (!d) return `<div class="card"><button id="back-to-deals" class="btn-primary">Back to Deals</button><div class="empty">Deal not found.</div></div>`;

  const ps = paymentSummary(d.id);
  const pd = paymentsForDeal(d.id);
  const docs = documentsForDeal(d.id);
  const containerList = cleanContainerNumbers(d.container_numbers);

  return `
    <div class="card">
      <div class="flex flex-between flex-center mb-20">
        <button id="back-to-deals" class="btn-primary">← Back to Deals</button>
        <div class="title mb-0">Deal Detail: ${esc(d.deal_no)}</div>
      </div>

      <div class="grid grid-2 gap-20">
        <div>
          <div class="form-header">Deal Info</div>
          <div class="item">
            <div class="item-sub">Status: <span class="badge ${d.status === "active" ? "badge-success" : "badge-danger"}">${esc(d.status)}</span></div>
            <div class="item-sub">Buyer: <strong>${esc(buyerName(d.buyer_id))}</strong></div>
            <div class="item-sub">Supplier: <strong>${esc(supplierName(d.supplier_id))}</strong></div>
            <div class="item-sub">Product: <strong>${esc(d.product_name)}</strong></div>
            <div class="item-sub">Quantity: ${esc(d.quantity)} ${esc(d.unit)}</div>
            <div class="item-sub">HSN Code: ${esc(d.hsn_code || "—")}</div>
          </div>
        </div>

        <div>
          <div class="form-header">Financial Summary</div>
          <div class="item">
            <div class="item-sub">Total Sale: <strong>${esc(d.document_currency)} ${fmtMoney(d.total_amount)}</strong></div>
            <div class="item-sub">Total Sale (AED): <strong>AED ${fmtMoney(d.total_amount_aed)}</strong></div>
            <div class="item-sub">Total Purchase (AED): <strong>AED ${fmtMoney(d.purchase_total_aed)}</strong></div>
            <div class="item-sub" style="color:var(--success)">Total Received: <strong>${esc(d.document_currency)} ${fmtMoney(ps.received)}</strong></div>
            <div class="item-sub" style="color:var(--danger)">Balance Due: <strong>${esc(d.document_currency)} ${fmtMoney(ps.balance)}</strong></div>
          </div>
        </div>
      </div>

      <div class="mt-20">
        <div class="form-header">Logistics</div>
        <div class="item">
          <div class="grid grid-3 gap-12">
            <div>
              <div class="label-xs">Vessel</div>
              <div class="font-bold">${esc(d.vessel || "—")}</div>
            </div>
            <div>
              <div class="label-xs">BL No</div>
              <div class="font-bold">${esc(d.bl_no || "—")}</div>
            </div>
            <div>
              <div class="label-xs">ETA</div>
              <div class="font-bold">${esc(d.eta || "—")}</div>
            </div>
          </div>
          <div class="mt-12">
            <div class="label-xs">Containers</div>
            <div class="item-sub" style="font-size:11px; opacity:0.8; word-break:break-all">${esc(containerList.join(", ") || "—")}</div>
          </div>
        </div>
      </div>

      <div class="mt-20">
        <div class="flex flex-between flex-center mb-10">
          <div class="form-header mb-0">Payments</div>
          <button data-show-payment-form="${d.id}" class="btn-primary btn-xs">+ Add Payment</button>
        </div>
        <div id="payment-form-wrap-${d.id}"></div>
        <div class="table-responsive">
          <table class="report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th class="right">Amount</th>
                <th>Currency</th>
                <th>Method</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${pd.length ? pd.map(p => `
                <tr>
                  <td>${new Date(p.payment_date).toLocaleDateString()}</td>
                  <td style="color:${p.direction === "in" ? "var(--success)" : "var(--danger)"}">${p.direction.toUpperCase()}</td>
                  <td class="right">${fmtMoney(p.amount)}</td>
                  <td>${esc(p.currency)}</td>
                  <td>${esc(p.method)}</td>
                  <td class="right">
                    <button data-edit-payment="${d.id}:${p.id}" class="btn-xs">Edit</button>
                    <button data-delete-payment="${d.id}:${p.id}" class="btn-xs text-danger">Delete</button>
                  </td>
                </tr>
                <tr><td colspan="6" id="payment-edit-wrap-${p.id}" style="padding:0"></td></tr>
              `).join("") : "<tr><td colspan='6' class='center opacity-50'>No payments recorded.</td></tr>"}
            </tbody>
          </table>
        </div>
      </div>

      <div class="mt-20">
        <div class="flex flex-between flex-center mb-10">
          <div class="form-header mb-0">Documents</div>
          <button data-show-document-form="${d.id}" class="btn-primary btn-xs">+ Add Document</button>
        </div>
        <div id="document-form-wrap-${d.id}"></div>
        <div class="grid grid-3 gap-12">
          ${docs.length ? docs.map(doc => `
            <div class="item p-10 flex flex-between flex-center">
              <div style="flex:1; min-width:0">
                <div class="font-bold text-xs truncate">${esc(doc.doc_type || "Document")}</div>
                <div class="opacity-50" style="font-size:10px">${esc(doc.file_name)}</div>
              </div>
              <div class="flex gap-8">
                <a href="${doc.file_url}" target="_blank" class="btn-xs">View</a>
                <button data-delete-placeholder-doc="${doc.id}" class="btn-xs text-danger">×</button>
              </div>
            </div>
          `).join("") : `<div class="empty" style="grid-column: span 3">No documents uploaded.</div>`}
        </div>
      </div>
    </div>
  `;
}
