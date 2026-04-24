import { state, buyerName, supplierName, paymentSummary, paymentsForDeal, documentsForDeal } from "./state.js";
import { esc, nextDealNo, fmtMoney } from "./utils.js";

export function dealsView() {
  const q = state.dealSearch.trim().toLowerCase();
  const filteredDeals = state.deals.filter((d) => {
    if (!q) return true;
    const buyer = buyerName(d.buyer_id).toLowerCase();
    const supplier = supplierName(d.supplier_id).toLowerCase();
    const text = [
      d.deal_no,
      d.product_name,
      d.hsn_code,
      d.loading_port,
      d.discharge_port,
      d.status,
      d.type,
      buyer,
      supplier
    ].join(" ").toLowerCase();
    return text.includes(q);
  });

  return `
    <div class="card">
      <div class="flex flex-between flex-center gap-12 mb-12 flex-wrap">
        <div class="title mb-0">Deals</div>
        <div class="flex gap-8 flex-wrap">
          <button id="export-deals-csv">Export CSV</button>
          <button id="show-deal-form" class="btn-primary">Add Deal</button>
        </div>
      </div>

      <div class="mb-12">
        <input id="deal-search" value="${esc(state.dealSearch || "")}" placeholder="Search by deal no, product, buyer, supplier, route..." />
      </div>

      <div id="deal-form-wrap"></div>

      <div class="list mt-12">
        ${
          filteredDeals.length
            ? filteredDeals.map((d) => {
                const s = paymentSummary(d.id, d.total_amount, d.document_currency === "USD" ? d.purchase_total_usd : d.purchase_total_aed);
                const curr = d.document_currency || d.currency || "AED";
                return `
            <div class="item">
              <div class="item-title">${esc(d.deal_no || "—")} · ${esc(d.product_name || "—")}</div>
              <div class="item-sub">${esc(d.loading_port || "—")} → ${esc(d.discharge_port || "—")}</div>
              <div class="item-sub">Buyer: ${esc(buyerName(d.buyer_id))} · Supplier: ${esc(supplierName(d.supplier_id))}</div>
              
              <div class="grid grid-2 mt-8 p-10" style="background:rgba(255,255,255,0.03); border-radius:4px">
                <div>
                  <div class="item-sub" style="font-weight:bold; color:var(--success)">Receivable (Buyer)</div>
                  <div class="item-title" style="font-size:14px">${curr} ${fmtMoney(s.receivable)}</div>
                  <div class="item-sub">Total: ${fmtMoney(s.sale)} | Rec: ${fmtMoney(s.received)}</div>
                </div>
                <div>
                  <div class="item-sub" style="font-weight:bold; color:var(--danger)">Payable (Supplier)</div>
                  <div class="item-title" style="font-size:14px">${curr} ${fmtMoney(s.payable)}</div>
                  <div class="item-sub">Total: ${fmtMoney(s.purchase)} | Sent: ${fmtMoney(s.sent)}</div>
                </div>
              </div>

              <div class="mt-8 flex gap-8 flex-wrap">
                <button data-open-deal="${d.id}">Open</button>
                <button data-show-payment-form="${d.id}">Add Payment</button>
                <button data-show-document-form="${d.id}">Upload Document</button>
                <button data-edit-deal="${d.id}">Edit</button>
                <button data-delete-deal="${d.id}">Delete</button>
              </div>

              <div class="mt-8 flex gap-8 flex-wrap">
                <button data-print-pi="${d.id}">Print PI</button>
                <button data-print-ci="${d.id}">Print CI</button>
                <button data-print-pl="${d.id}">Print PL</button>
                <button data-print-coo="${d.id}">Print COO</button>
              </div>

              <div id="deal-edit-wrap-${d.id}" class="mt-10"></div>
              <div id="payment-form-wrap-${d.id}" class="mt-10"></div>
              <div id="document-form-wrap-${d.id}" class="mt-10"></div>

              <div class="list mt-10">
                ${
                  payments.length
                    ? payments.map((p) => `
                  <div class="item" style="padding:10px">
                    <div class="item-title">${esc(p.currency || d.currency || "AED")} ${fmtMoney(p.amount)}</div>
                    <div class="item-sub">${esc(p.direction || "in")} · ${esc(p.method || "—")} · ${esc(p.status || "pending")}</div>
                    <div class="item-sub">${esc(p.ref || "—")} · ${esc(p.payment_date || "—")}</div>
                    <div class="mt-8 flex gap-8">
                      <button data-edit-payment="${d.id}:${p.id}" class="btn-small">Edit</button>
                      <button data-delete-payment="${d.id}:${p.id}" class="btn-danger btn-small">Delete</button>
                    </div>
                    <div id="payment-edit-wrap-${p.id}" class="mt-8"></div>
                  </div>
                `).join("")
                    : `<div class="item-sub">No payments yet.</div>`
                }
              </div>

              <div class="list mt-10">
                <div style="font-weight:600; font-size:12px; margin-bottom:5px; opacity:0.8">DOCUMENTS</div>
                ${
                  documents.length
                    ? documents.map((doc) => `
                  <div class="item" style="padding:10px">
                    <div class="item-title">${esc(doc.doc_type || "Document")}</div>
                    <div class="item-sub">${esc(doc.file_name || "—")}</div>
                    <div class="mt-8 flex gap-8">
                      <a href="${doc.file_url}" target="_blank" class="btn-small">View</a>
                      <button data-edit-document="${d.id}:${doc.id}" class="btn-small">Edit</button>
                      <button data-delete-placeholder-doc="${d.id}:${doc.id}" class="btn-danger btn-small">Delete</button>
                    </div>
                    <div id="document-edit-wrap-${doc.id}" class="mt-8"></div>
                  </div>
                `).join("")
                    : `<div class="item-sub">No documents yet.</div>`
                }
              </div>
            </div>
          `;
              }).join("")
            : `<div class="empty">No matching deals found.</div>`
        }
      </div>
    </div>
  `;
}

export function dealFormHtml(d = {}, edit = false, id = "") {
  const currentDocCurrency = d.document_currency || d.currency || "USD";

  return `
    <form id="${edit ? `deal-edit-form-${id}` : "deal-form"}" class="item mb-12">
      <div class="form-header">${edit ? "Edit Deal" : "New Deal"}</div>

      <div class="grid gap-12">

        <div class="grid grid-2 gap-10">
          <div>
            <label class="form-label">Deal Type</label>
            <select name="type" required>
              <option value="sell" ${d.type === "sell" ? "selected" : ""}>Sell</option>
              <option value="purchase" ${d.type === "purchase" ? "selected" : ""}>Purchase</option>
            </select>
          </div>
          <div>
            <label class="form-label">Deal No</label>
            <input name="deal_no" value="${esc(d.deal_no || nextDealNo())}" required>
          </div>
        </div>

        <div class="grid grid-2 gap-10">
          <div>
            <label class="form-label">Product Name</label>
            <select name="product_name" id="${edit ? `product-name-${id}` : "product-name"}" required>
              <option value="">Select product</option>
              ${(state.products || []).map((p) => `
                <option
                  value="${esc(p.name)}"
                  data-hsn="${esc(p.hsn_code || "")}"
                  ${d.product_name === p.name ? "selected" : ""}
                >
                  ${esc(p.name)}
                </option>
              `).join("")}
            </select>
          </div>

          <div>
            <label class="form-label">HSN Code</label>
            <input
              name="hsn_code"
              id="${edit ? `hsn-code-${id}` : "hsn-code"}"
              value="${esc(d.hsn_code || "")}"
              placeholder="HSN Code"
            >
          </div>
        </div>

        <div class="grid grid-3 gap-10">
          <div>
            <label class="form-label">Unit</label>
            <input name="unit" value="${esc(d.unit || "MTON")}" placeholder="Unit">
          </div>
          <div>
            <label class="form-label">Base Currency</label>
            <select name="base_currency" id="${edit ? `base-currency-${id}` : "base-currency"}">
              <option value="USD" ${(d.base_currency || "USD") === "USD" ? "selected" : ""}>USD</option>
              <option value="AED" ${d.base_currency === "AED" ? "selected" : ""}>AED</option>
            </select>
          </div>
          <div>
            <label class="form-label">Document Shipper</label>
            <select name="shipper_index">
              <option value="">Default Company</option>
              ${(state.company.shippers || []).map((s, i) => `
                <option value="${i}" ${String(d.shipper_index ?? "") === String(i) ? "selected" : ""}>
                  ${esc(s.name || "Shipper")} - ${esc(s.mobile || "")}
                </option>
              `).join("")}
            </select>
          </div>
        </div>

        <div class="grid grid-4 gap-10">
          <div>
            <label class="form-label">Conversion Rate (USD → AED)</label>
            <input name="conversion_rate" id="${edit ? `conversion-rate-${id}` : "conversion-rate"}" type="number" step="0.0001" value="${esc(d.conversion_rate || "")}" placeholder="e.g. 3.6725">
          </div>
          <div>
            <label class="form-label">Document Currency</label>
            <select name="document_currency">
              <option value="AED" ${currentDocCurrency === "AED" ? "selected" : ""}>AED</option>
              <option value="USD" ${currentDocCurrency === "USD" ? "selected" : ""}>USD</option>
            </select>
          </div>
          <div>
            <label class="form-label">Status</label>
            <select name="status">
              <option value="active" ${d.status === "active" ? "selected" : ""}>active</option>
              <option value="shipped" ${d.status === "shipped" ? "selected" : ""}>shipped</option>
              <option value="invoiced" ${d.status === "invoiced" ? "selected" : ""}>invoiced</option>
              <option value="completed" ${d.status === "completed" ? "selected" : ""}>completed</option>
            </select>
          </div>
          <div>
            <label class="form-label">Approval Status</label>
            <select name="approval_status">
              <option value="draft" ${(d.approval_status || "draft") === "draft" ? "selected" : ""}>draft</option>
              <option value="under_review" ${d.approval_status === "under_review" ? "selected" : ""}>under_review</option>
              <option value="approved" ${d.approval_status === "approved" ? "selected" : ""}>approved</option>
              <option value="locked" ${d.approval_status === "locked" ? "selected" : ""}>locked</option>
            </select>
          </div>
        </div>

        <div class="grid grid-2 gap-10">
          <div>
            <label class="form-label">Sale Rate (to Buyer)</label>
            <input name="rate" id="${edit ? `rate-${id}` : "rate"}" type="number" step="0.01" value="${esc(d.rate || "")}">
          </div>
          <div>
            <label class="form-label">Purchase Rate (from Supplier)</label>
            <input name="purchase_rate" id="${edit ? `purchase-rate-${id}` : "purchase-rate"}" type="number" step="0.01" value="${esc(d.purchase_rate || "")}">
          </div>
        </div>

        <div class="grid grid-4 gap-10">
          <div>
            <label class="form-label">Quantity</label>
            <input name="quantity" id="${edit ? `quantity-${id}` : "quantity"}" type="number" step="0.001" value="${esc(d.quantity || "")}">
          </div>
          <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:4px">
            <label class="form-label">Sale Total (USD)</label>
            <input name="total_amount_usd" id="${edit ? `total-${id}` : "total"}" type="number" step="0.01" value="${esc(d.total_amount_usd || "")}" readonly style="background:transparent">
            <label class="form-label" style="margin-top:5px">Sale Total (AED)</label>
            <input name="total_amount_aed" id="${edit ? `total-aed-${id}` : "total-aed"}" type="number" step="0.01" value="${esc(d.total_amount_aed || "")}" readonly style="background:transparent">
          </div>
          <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:4px">
            <label class="form-label">Purchase Total (USD)</label>
            <input name="purchase_total_usd" id="${edit ? `purchase-total-${id}` : "purchase-total"}" type="number" step="0.01" value="${esc(d.purchase_total_usd || "")}" readonly style="background:transparent">
            <label class="form-label" style="margin-top:5px">Purchase Total (AED)</label>
            <input name="purchase_total_aed" id="${edit ? `purchase-total-aed-${id}` : "purchase-total-aed"}" type="number" step="0.01" value="${esc(d.purchase_total_aed || "")}" readonly style="background:transparent">
          </div>
        </div>

        <div class="grid grid-2 gap-10">
          <div>
            <label class="form-label">Loading Port</label>
            <input name="loading_port" value="${esc(d.loading_port || "")}">
          </div>
          <div>
            <label class="form-label">Discharge Port</label>
            <input name="discharge_port" value="${esc(d.discharge_port || "")}">
          </div>
        </div>

        <div class="card">
          <div class="title">Shipment Details</div>
          <div class="grid grid-2 gap-10 mt-10">
            <div>
              <label class="form-label">Vessel Name</label>
              <input name="vessel" value="${esc(d.vessel || "")}">
            </div>
            <div>
              <label class="form-label">Vessel / Voyage</label>
              <input name="vessel_voyage" value="${esc(d.vessel_voyage || "")}">
            </div>
            <div>
              <label class="form-label">Shipment Out Date</label>
              <input name="shipment_out_date" type="date" value="${esc(d.shipment_out_date || "")}">
            </div>
            <div>
              <label class="form-label">ETA</label>
              <input name="eta" type="date" value="${esc(d.eta || "")}">
            </div>
            <div>
              <label class="form-label">Freight Type</label>
              <input name="freight_type" value="${esc(d.freight_type || "BY SEA")}">
            </div>
            <div>
              <label class="form-label">Shipment Status</label>
              <select name="shipment_status">
                <option value="pending" ${d.shipment_status === "pending" ? "selected" : ""}>Pending</option>
                <option value="in_transit" ${d.shipment_status === "in_transit" ? "selected" : ""}>In Transit</option>
                <option value="delivered" ${d.shipment_status === "delivered" ? "selected" : ""}>Delivered</option>
              </select>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="title">Packing / BL / Weight</div>
          <div class="grid grid-2 gap-10 mt-10">
            <div>
              <label class="form-label">Gross Weight</label>
              <input name="gross_weight" type="number" step="0.001" value="${esc(d.gross_weight || "")}">
            </div>
            <div>
              <label class="form-label">Net Weight</label>
              <input name="net_weight" type="number" step="0.001" value="${esc(d.net_weight || "")}">
            </div>
            <div>
              <label class="form-label">Package Details</label>
              <input name="package_details" value="${esc(d.package_details || "20ft x 10 Containers")}">
            </div>
            <div>
              <label class="form-label">Loaded On</label>
              <input name="loaded_on" value="${esc(d.loaded_on || "ISO TANK")}">
            </div>
            <div>
              <label class="form-label">BL No</label>
              <input name="bl_no" value="${esc(d.bl_no || "")}">
            </div>
            <div>
              <label class="form-label">CFS</label>
              <input name="cfs" value="${esc(d.cfs || "")}">
            </div>
          </div>
          <div class="mt-10">
            <label class="form-label">Container Numbers (one per line or comma separated)</label>
            <textarea
              name="container_numbers"
              style="min-height:110px"
              placeholder="Enter one container number per line&#10;Example:&#10;RLTU2087940&#10;RLTU2038966&#10;RLTU2106736"
            >${esc(
              Array.isArray(d.container_numbers)
                ? d.container_numbers.join("\n")
                : String(d.container_numbers || "")
                    .split(/[,\n]+/)
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .join("\n")
            )}</textarea>
          </div>
        </div>

        <div class="card">
          <div class="title">Document / Terms</div>
          <div class="grid grid-2 gap-10 mt-10">
            <div>
              <label class="form-label">Country of Origin</label>
              <input name="country_of_origin" value="${esc(d.country_of_origin || "")}">
            </div>
            <div>
              <label class="form-label">Invoice Date</label>
              <input name="invoice_date" type="date" value="${esc(d.invoice_date || "")}">
            </div>
            <div>
              <label class="form-label">PI No</label>
              <input name="pi_no" value="${esc(d.pi_no || "")}">
            </div>
            <div>
              <label class="form-label">CI No</label>
              <input name="ci_no" value="${esc(d.ci_no || "")}">
            </div>
            <div>
              <label class="form-label">PL No</label>
              <input name="pl_no" value="${esc(d.pl_no || "")}">
            </div>
            <div>
              <label class="form-label">COO No</label>
              <input name="coo_no" value="${esc(d.coo_no || "")}">
            </div>
          </div>

          <div class="mt-10">
            <label class="form-label">Terms of Delivery</label>
            <input name="terms_delivery" value="${esc(d.terms_delivery || "")}">
          </div>
          <div class="mt-10">
            <label class="form-label">Payment Terms</label>
            <input name="payment_terms" value="${esc(d.payment_terms || "")}">
          </div>
          <div class="mt-10">
            <label class="form-label">Bank Terms</label>
            <input name="bank_terms" value="${esc(d.bank_terms || "ALL BANKS ON BUYERS ACC. ONLY")}">
          </div>

          <div class="mt-10">
            <label class="form-label">Document Bank Account</label>
            <select name="document_bank_index">
              <option value="">Primary Bank</option>
              ${(state.company.bankAccounts || []).map((b, i) => `
                <option value="${i}" ${String(d.document_bank_index ?? "") === String(i) ? "selected" : ""}>
                  ${esc(b.bankName || "Bank")} - ${esc(b.account || "")}
                </option>
              `).join("")}
            </select>
          </div>

          <div class="mt-10">
            <label class="form-label">Document Shipper</label>
            <select name="shipper_index">
              <option value="">Default Company</option>
              ${(state.company.shippers || []).map((s, i) => `
                <option value="${i}" ${String(d.shipper_index ?? "") === String(i) ? "selected" : ""}>
                  ${esc(s.name || "Shipper")} - ${esc(s.mobile || "")}
                </option>
              `).join("")}
            </select>
          </div>
        </div>

        <div class="grid grid-2 gap-10">
          <div>
            <label class="form-label">Buyer</label>
            <select name="buyer_id">
              <option value="">Select buyer</option>
              ${state.buyers.map((b) => `<option value="${b.id}" ${String(d.buyer_id) === String(b.id) ? "selected" : ""}>${esc(b.name)}</option>`).join("")}
            </select>
          </div>
          <div>
            <label class="form-label">Supplier</label>
            <select name="supplier_id">
              <option value="">Select supplier</option>
              ${state.suppliers.map((s) => `<option value="${s.id}" ${String(d.supplier_id) === String(s.id) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="flex gap-10">
          <button type="submit" class="btn-primary">${edit ? "Update Deal" : "Save Deal"}</button>
          <button type="button" id="${edit ? `cancel-deal-edit-${id}` : "cancel-deal-form"}">Cancel</button>
        </div>
      </div>
    </form>
  `;
}
