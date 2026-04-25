import { state, getSelectedDeal, paymentsForDeal, documentsForDeal, paymentSummary, dealAuditLogs } from "./state.js";
import { esc, formatAuditValue, formatAuditTime, fmtMoney } from "./utils.js";

export function dealDetailView() {
  const d = getSelectedDeal();
  if (!d) return `<div class="card"><div class="title">Deal not found</div></div>`;

  const buyer = state.buyers.find((b) => String(b.id) === String(d.buyer_id));
  const supplier = state.suppliers.find((s) => String(s.id) === String(d.supplier_id));
  const payments = paymentsForDeal(d.id);
  const documents = documentsForDeal(d.id);
  const showCurrency = d.document_currency || d.currency || d.base_currency || "AED";
  
  const showTotal = showCurrency === "USD"
    ? Number(d.total_amount_usd || d.total_amount || 0)
    : Number(d.total_amount_aed || d.total_amount || 0);
  const pTotal = showCurrency === "USD" ? (d.purchase_total_usd || 0) : (d.purchase_total_aed || 0);
  const s = paymentSummary(d.id, showTotal, pTotal);

  const statusClass = d.status === 'active' ? 'badge-active' : 'badge-draft';

  return `
    <div class="deal-header fade-in">
      <div>
        <div class="flex items-center gap-12 mb-12">
          <h1 style="font-size: 28px; font-weight: 800;">${esc(d.deal_no || "Deal Detail")}</h1>
          <span class="deal-badge ${statusClass}">${esc(d.status || "active")}</span>
        </div>
        <p class="text-muted">Created on ${new Date(d.created_at).toLocaleDateString()}</p>
      </div>
      <div class="flex gap-12">
        <button id="back-to-deals" class="btn btn-outline">Back to List</button>
        <button data-edit-deal="${d.id}" class="btn btn-primary">Edit Deal</button>
      </div>
    </div>

    <div id="deal-edit-wrap-${d.id}" class="mb-24"></div>

    <div class="grid grid-2 fade-in" style="align-items: start;">
      
      <!-- Left Column: Info & Shipping -->
      <div class="grid gap-24">
        
        <div class="card">
          <h3 class="section-title">📦 Product Information</h3>
          <div class="grid grid-2 gap-16">
            <div><label>Product Name</label><div class="item-title">${esc(d.product_name || "—")}</div></div>
            <div><label>HSN Code</label><div class="item-title">${esc(d.hsn_code || "—")}</div></div>
            <div><label>Quantity</label><div class="item-title">${esc(d.quantity || "0")} ${esc(d.unit || "")}</div></div>
            <div><label>Origin</label><div class="item-title">${esc(d.country_of_origin || "—")}</div></div>
          </div>
        </div>

        <div class="card">
          <h3 class="section-title">🚢 Shipping & Logistics</h3>
          <div class="grid grid-2 gap-16">
            <div><label>Vessel / Voyage</label><div class="item-title">${esc(d.vessel_voyage || d.vessel || "—")}</div></div>
            <div><label>BL Number</label><div class="item-title">${esc(d.bl_no || "—")}</div></div>
            <div><label>Loading Port</label><div class="item-title">${esc(d.loading_port || "—")}</div></div>
            <div><label>Discharge Port</label><div class="item-title">${esc(d.discharge_port || "—")}</div></div>
            <div><label>Shipment Date</label><div class="item-title">${esc(d.shipment_out_date || "—")}</div></div>
            <div><label>ETA</label><div class="item-title">${esc(d.eta || "—")}</div></div>
          </div>
        </div>

        <div class="card">
          <h3 class="section-title">🏢 Trading Parties</h3>
          <div class="grid grid-2 gap-16">
            <div>
              <label>Buyer (Consignee)</label>
              <div class="item-title">${esc(buyer?.name || "—")}</div>
              <div class="item-sub">${esc(buyer?.address || "")}</div>
            </div>
            <div>
              <label>Supplier</label>
              <div class="item-title">${esc(supplier?.name || "—")}</div>
              <div class="item-sub">${esc(supplier?.company_name || "")}</div>
            </div>
          </div>
        </div>

      </div>

      <!-- Right Column: Financials & Actions -->
      <div class="grid gap-24">
        
        <div class="card" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid var(--primary);">
          <h3 class="section-title">💰 Financial Overview (${esc(showCurrency)})</h3>
          
          <div class="grid grid-2 gap-16 mb-24">
            <div class="stat-card">
              <span class="stat-label" style="color: var(--success)">Receivable</span>
              <span class="stat-value">${fmtMoney(s.receivable)}</span>
              <span class="item-sub">Received: ${fmtMoney(s.received)}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label" style="color: var(--danger)">Payable</span>
              <span class="stat-value">${fmtMoney(s.payable)}</span>
              <span class="item-sub">Paid: ${fmtMoney(s.sent)}</span>
            </div>
          </div>

          <div style="padding-top: 16px; border-top: 1px solid var(--border);">
            <div class="flex justify-between items-center">
              <div>
                <span class="stat-label">Expected Profit</span>
                <div class="stat-value" style="color: var(--text-main); font-size: 22px;">${fmtMoney(s.sale - s.purchase)}</div>
              </div>
              <div style="text-align: right">
                <span class="stat-label">Margin</span>
                <div class="stat-value" style="color: var(--success); font-size: 22px;">${(s.sale > 0 ? ((s.sale - s.purchase) / s.sale) * 100 : 0).toFixed(2)}%</div>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 class="section-title">📋 Document Actions</h3>
          <div class="grid gap-12">
            <div class="flex gap-8 flex-wrap">
              <button data-print-pi="${d.id}" class="btn btn-outline btn-small">Proforma Invoice</button>
              <button data-print-ci="${d.id}" class="btn btn-outline btn-small">Commercial Invoice</button>
              <button data-print-pl="${d.id}" class="btn btn-outline btn-small">Packing List</button>
              <button data-print-coo="${d.id}" class="btn btn-outline btn-small">Cert. of Origin</button>
            </div>
            <div class="flex gap-8 mt-10">
              <button data-print-supplier-statement="${d.id}" class="btn btn-primary btn-small w-full">Supplier Settlement</button>
              <button data-print-buyer-statement="${d.id}" class="btn btn-primary btn-small w-full">Buyer Settlement</button>
            </div>
          </div>
        </div>

      </div>

    </div>

    <!-- Bottom Sections: Payments & Documents -->
    <div class="grid gap-24 mt-24 fade-in">
      
      <div class="card">
        <div class="flex justify-between items-center mb-16">
          <h3 class="section-title mb-0">💳 Payments & Transactions</h3>
          <button data-show-payment-form="${d.id}" class="btn btn-primary btn-small">+ Add Payment</button>
        </div>
        <div id="payment-form-wrap-${d.id}" class="mb-16"></div>
        <div class="list">
          ${payments.length ? payments.map((p) => `
            <div class="item flex justify-between items-center">
              <div>
                <div class="item-title">${esc(p.currency || d.currency || "AED")} ${fmtMoney(p.amount)}</div>
                <div class="item-sub">${esc(p.direction).toUpperCase()} · ${esc(p.method)} · ${esc(p.payment_date)}</div>
                <div class="item-sub" style="font-style: italic;">"${esc(p.ref || "No reference")}"</div>
              </div>
              <div class="flex gap-8">
                <button data-edit-payment="${d.id}:${p.id}" class="btn btn-outline btn-small">Edit</button>
                <button data-delete-payment="${d.id}:${p.id}" class="btn btn-logout btn-small" style="padding: 6px 10px;">Delete</button>
              </div>
              <div id="payment-edit-wrap-${p.id}" class="w-full"></div>
            </div>
          `).join("") : `<div class="empty">No payment records found.</div>`}
        </div>
      </div>

      <div class="card">
        <div class="flex justify-between items-center mb-16">
          <h3 class="section-title mb-0">📁 Attached Documents</h3>
          <div class="flex gap-8">
             <button id="toggle-upload-form" class="btn btn-primary btn-small" onclick="document.getElementById('upload-form-container').style.display='block'">+ Upload</button>
          </div>
        </div>
        
        <div id="upload-form-container" style="display:none;" class="mb-16 p-16 card" style="background: rgba(0,0,0,0.2)">
           <form data-placeholder-upload="${d.id}" class="grid gap-12">
             <div class="grid grid-2 gap-12">
               <div>
                 <label>Document Type</label>
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
               </div>
               <div>
                 <label>Select File</label>
                 <input type="file" name="file" required>
               </div>
             </div>
             <div class="flex gap-8">
               <button type="submit" class="btn btn-primary btn-small">Start Upload</button>
               <button type="button" class="btn btn-outline btn-small" onclick="this.closest('#upload-form-container').style.display='none'">Cancel</button>
             </div>
           </form>
        </div>

        <div class="list">
          ${documents.length ? documents.map((doc) => `
            <div class="item flex justify-between items-center">
              <div class="flex items-center gap-16">
                <div style="font-size: 24px;">${doc.doc_type === 'BL' ? '🚢' : '📄'}</div>
                <div>
                  <div class="item-title">${esc(doc.doc_type || "Document")}</div>
                  <div class="item-sub">${esc(doc.file_name)}</div>
                </div>
              </div>
              <div class="flex gap-8">
                ${doc.file_url ? `<a href="${doc.file_url}" target="_blank" class="btn btn-outline btn-small">View</a>` : ''}
                ${doc.doc_type === 'BL' ? `<button data-ai-scan="${d.id}:${doc.id}" class="btn btn-primary btn-small" style="background:#6366f1">AI Scan</button>` : ''}
                <button data-delete-placeholder-doc="${d.id}:${doc.id}" class="btn btn-logout btn-small" style="padding: 6px 10px;">Delete</button>
              </div>
            </div>
          `).join("") : `<div class="empty">No documents uploaded.</div>`}
        </div>
      </div>

      <div class="card">
        <h3 class="section-title">📜 Activity Log</h3>
        <div class="list" style="max-height: 300px; overflow-y: auto; padding-right: 10px;">
          ${dealAuditLogs(d.id).length ? dealAuditLogs(d.id).map((log) => `
            <div class="item" style="padding: 10px; border-left: 3px solid var(--border);">
              <div class="flex justify-between">
                 <span class="item-title" style="color: var(--primary)">${esc(log.action).toUpperCase()}</span>
                 <span class="item-sub">${esc(formatAuditTime(log.created_at))}</span>
              </div>
              <div class="item-sub" style="margin-top: 2px;">
                ${log.field_name ? `Changed <b>${esc(log.field_name)}</b> from <span class="text-danger">${esc(formatAuditValue(log.old_value))}</span> to <span class="text-success">${esc(formatAuditValue(log.new_value))}</span>` : 'Document updated'}
              </div>
            </div>
          `).join("") : `<div class="item-sub">No recent activity.</div>`}
        </div>
      </div>

    </div>
  `;
}
