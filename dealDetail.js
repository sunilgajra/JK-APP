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
  const s = paymentSummary(d.id, showTotal, pTotal, showCurrency);

  return `
    <div class="card">
      <div class="flex flex-between flex-center gap-12 mb-12">
        <div class="title mb-0">${esc(d.deal_no || "Deal Detail")}</div>
        <a href="#/deals" class="btn-outline" id="back-to-deals">Back</a>
      </div>

      <div class="grid grid-2">
        <div class="item"><div class="item-title">Product</div><div class="item-sub">${esc(d.product_name || "—")}</div></div>
        <div class="item"><div class="item-title">HSN Code</div><div class="item-sub">${esc(d.hsn_code || "—")}</div></div>
        <div class="item"><div class="item-title">Status</div><div class="item-sub">${esc(d.status || "active")}</div></div>
        <div class="item"><div class="item-title">Approval Status</div><div class="item-sub">${esc(d.approval_status || "draft")}</div></div>
        <div class="item"><div class="item-title">Route</div><div class="item-sub">${esc(d.loading_port || "—")} → ${esc(d.discharge_port || "—")}</div></div>
        <div class="item"><div class="item-title">Value</div><div class="item-sub">${esc(showCurrency)} ${fmtMoney(showTotal)}</div></div>
        <div class="item"><div class="item-title">Base Currency</div><div class="item-sub">${esc(d.base_currency || "USD")}</div></div>
        <div class="item"><div class="item-title">Document Currency</div><div class="item-sub">${esc(d.document_currency || d.currency || "AED")}</div></div>
        <div class="item"><div class="item-title">Conversion Rate</div><div class="item-sub">${esc(d.conversion_rate || "—")}</div></div>
        <div class="item"><div class="item-title">Total USD</div><div class="item-sub">USD ${fmtMoney(d.total_amount_usd)}</div></div>
        <div class="item"><div class="item-title">Total AED</div><div class="item-sub">AED ${fmtMoney(d.total_amount_aed)}</div></div>
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

      <div class="item mt-12 grid grid-2 gap-10" style="background:rgba(255,255,255,0.03); padding:15px; border-radius:8px">
        <div>
          <div class="item-title" style="color:var(--success)">Receivable (Buyer)</div>
          <div class="title" style="font-size:20px; margin-bottom:5px">${esc(showCurrency)} ${fmtMoney(s.receivable)}</div>
          <div class="item-sub">Sale Total: ${fmtMoney(s.sale)}</div>
          <div class="item-sub">Received: ${fmtMoney(s.received)}</div>
        </div>
        <div>
          <div class="item-title" style="color:var(--danger)">Payable (Supplier)</div>
          <div class="title" style="font-size:20px; margin-bottom:5px">${esc(showCurrency)} ${fmtMoney(s.payable)}</div>
          <div class="item-sub">Purchase Total: ${fmtMoney(s.purchase)}</div>
          <div class="item-sub">Sent to Supplier: ${fmtMoney(s.sent)}</div>
        </div>
      </div>

      <div class="item mt-12" style="background:linear-gradient(90deg, rgba(var(--primary-rgb), 0.1), transparent); padding:15px; border-radius:8px; border-left: 4px solid var(--primary)">
        <div class="grid grid-2 gap-10">
          <div>
            <div class="item-title" style="color:var(--primary)">Profit (AED)</div>
            <div class="title" style="font-size:20px">AED ${fmtMoney(d.document_currency === "USD" ? (s.sale - s.purchase) * (d.conversion_rate || 3.6725) : (s.sale - s.purchase))}</div>
          </div>
          <div style="text-align:right">
            <div class="item-title">Profit Margin</div>
            <div class="title" style="font-size:20px; color:var(--primary)">${(s.sale > 0 ? ((s.sale - s.purchase) / s.sale) * 100 : 0).toFixed(2)}%</div>
          </div>
        </div>
      </div>

      <div class="item mt-12">
        <div class="item-title">Account Statements</div>
        <div class="mt-8 flex gap-8 flex-wrap">
          <button data-print-supplier-statement="${d.id}" class="btn-primary">Supplier Settlement</button>
          <button data-print-buyer-statement="${d.id}" class="btn-primary">Buyer Settlement</button>
        </div>
      </div>

      <div class="item mt-12">
        <div class="item-title">Export Documents</div>
        <div class="mt-8 flex gap-8 flex-wrap">
          <button data-print-pi="${d.id}">Print PI</button>
          <button data-print-ci="${d.id}">Print CI</button>
          <button data-print-pl="${d.id}">Print PL</button>
          <button data-print-coo="${d.id}">Print COO</button>
        </div>
      </div>

      <div class="item mt-12">
        <div class="item-title">Deal Documents</div>

        <form data-placeholder-upload="${d.id}" class="mt-10 grid gap-10">
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

          <div class="flex gap-10">
            <button type="submit" class="btn-primary">Upload Document</button>
          </div>
        </form>

        <div class="list mt-12">
          ${documents.length
      ? documents.map((doc, idx) => `
            <div class="item" style="padding:10px">
              <div class="item-title">${esc(doc.doc_type || doc.type || "Document")}</div>
              <div class="item-sub">${esc(doc.file_name || "No file selected")}</div>
              <div class="item-sub">${esc(doc.mime_type || "Uploaded file")}</div>
              <div class="mt-8 flex gap-8 flex-wrap">
                ${doc.file_url
          ? `<a href="${doc.file_url}" target="_blank" rel="noopener noreferrer">View</a>
                       <a href="${doc.file_url}" download="${esc(doc.file_name || "file")}">Download</a>`
          : `<span style="opacity:.6">No file URL</span>`
        }
                <button data-edit-document="${d.id}:${doc.id}" type="button">Edit</button>
                <button data-delete-placeholder-doc="${d.id}:${doc.id}" type="button">Delete</button>
                ${doc.doc_type === 'BL' ? `<button data-ai-scan="${d.id}:${doc.id}" class="btn-primary" style="background:#6366f1">Scan with AI</button>` : ''}
              </div>
              <div id="document-edit-wrap-${doc.id}" class="mt-8"></div>
            </div>
          `).join("")
      : `<div class="item-sub">No documents added yet.</div>`
    }
        </div>
      </div>

      <div class="item mt-12">
        <div class="item-title">Payments</div>
        <div class="mt-8">
          <button data-show-payment-form="${d.id}">Add Payment</button>
        </div>
        <div id="payment-form-wrap-${d.id}" class="mt-10"></div>
        <div class="list mt-10">
          ${payments.length
      ? payments.map((p) => `
            <div class="item" style="padding:10px">
              <div class="item-title">${esc(p.currency || d.currency || "AED")} ${fmtMoney(p.amount)}</div>
              <div class="item-sub">${esc(p.direction || "in")} · ${esc(p.method || "—")} · ${esc(p.status || "pending")}</div>
              <div class="item-sub">${esc(p.ref || "—")} · ${esc(p.payment_date || "—")}</div>
              <div class="mt-8 flex gap-8">
                <button data-edit-payment="${d.id}:${p.id}">Edit</button>
                <button data-delete-payment="${d.id}:${p.id}">Delete Payment</button>
              </div>
              <div id="payment-edit-wrap-${p.id}" class="mt-8"></div>
            </div>
          `).join("")
      : `<div class="item-sub">No payments yet.</div>`
    }
        </div>
      </div>

      <div class="item mt-12">
        <div class="item-title">Activity History</div>
        <div class="list mt-10">
          ${dealAuditLogs(d.id).length
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
