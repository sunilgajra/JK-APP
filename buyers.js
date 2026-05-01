import { state } from "./state.js";
import { esc, nextCustomerId } from "./utils.js";

export function buyersView() {
  console.log("VIEWING BUYERS - STATE COUNT:", state.buyers.length);
  const q = state.buyerSearch.trim().toLowerCase();
  const filteredBuyers = state.buyers.filter((b) => {
    if (!q) return true;
    const text = [b.name, b.email, b.address, b.gst, b.iec, b.customer_id, b.phone].join(" ").toLowerCase();
    return text.includes(q);
  });

  return `
    <div class="card">
      <div class="flex flex-between flex-center gap-12 mb-12 flex-wrap">
        <div class="title mb-0">Buyers</div>
        <button id="show-buyer-form" class="btn-primary">Add Buyer</button>
      </div>

      <div class="mb-12">
        <input id="buyer-search" value="${esc(state.buyerSearch || "")}" placeholder="Search buyers by name, address, GST, IEC..." />
      </div>

      <div id="buyer-form-wrap"></div>

      <div class="list mt-12">
        ${
          filteredBuyers.length
            ? filteredBuyers.map((b) => `
          <div class="item">
            <div class="item-title">${esc(b.name || "—")}</div>
            <div class="item-sub">${esc(b.address || "—")}</div>
            <div class="item-sub">GST: ${esc(b.gst || "—")} · IEC: ${esc(b.iec || "—")}</div>
            <div class="item-sub">Customer ID: ${esc(b.customer_id || "—")} · Email: ${esc(b.email || "—")}</div>
            <div class="item-sub">Phone: ${esc(b.phone || "—")}</div>
            <div class="mt-8 flex gap-8 flex-wrap">
              <button data-edit-buyer="${b.id}">Edit</button>
              <button data-delete-buyer="${b.id}">Delete</button>
              <button data-show-buyer-master-deals="${b.id}" class="btn-info">Master Settlement</button>
            </div>
            <div id="buyer-master-deals-wrap-${b.id}" class="mt-10" style="display:none; background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; border:1px solid rgba(59,157,162,0.3)">
              <div class="item-title mb-8" style="font-size:14px; color:var(--accent-primary)">Select Deals for Master Settlement</div>
              <div class="table-responsive" style="max-height:250px; overflow:auto; border: 1px solid var(--border); border-radius: 6px; background: rgba(0,0,0,0.2);">
                <table class="report-table" style="margin-top:0; width:100%; font-size: 12px;">
                  <thead style="position: sticky; top: 0; z-index: 10; background: rgba(15, 23, 42, 0.95);">
                    <tr>
                      <th style="width: 40px; text-align: center; padding: 8px;">
                        <input type="checkbox" checked onclick="document.querySelectorAll('input[name=\\'master_deal_ids_${b.id}\\']').forEach(cb => cb.checked = this.checked)">
                      </th>
                      <th style="padding: 8px;">Deal No</th>
                      <th style="padding: 8px;">BL No</th>
                      <th style="padding: 8px;">Supplier</th>
                      <th style="padding: 8px;">Product</th>
                      <th style="padding: 8px;">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${state.deals.filter(d => (d.is_high_seas ? String(d.high_seas_buyer_id) === String(b.id) : String(d.buyer_id) === String(b.id))).map(d => `
                      <tr>
                        <td style="text-align: center; padding: 8px;">
                          <input type="checkbox" name="master_deal_ids_${b.id}" value="${d.id}" checked>
                        </td>
                        <td class="font-bold" style="padding: 8px; color: var(--text);">${esc(d.deal_no)}</td>
                        <td style="padding: 8px;">${esc(d.bl_no || "—")}</td>
                        <td style="padding: 8px;">${esc((state.suppliers.find(s => String(s.id) === String(d.supplier_id)) || {}).name || "—")}</td>
                        <td style="padding: 8px;">${esc(d.product_name)}</td>
                        <td class="opacity-60" style="padding: 8px;">${new Date(d.invoice_date || d.created_at).toLocaleDateString()}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
                ${state.deals.filter(d => (d.is_high_seas ? String(d.high_seas_buyer_id) === String(b.id) : String(d.buyer_id) === String(b.id))).length === 0 ? '<div style="padding:10px; text-align:center; opacity:0.5; font-size:12px;">No deals found.</div>' : ''}
              </div>
              <div class="mt-8 flex gap-8 flex-wrap">
                <button data-print-buyer-master-selected="${b.id}" class="btn-primary btn-xs">Generate Settlement</button>
                <button onclick="document.getElementById('buyer-master-deals-wrap-${b.id}').style.display='none'" class="btn-xs">Cancel</button>
              </div>
            </div>
            <div id="buyer-edit-wrap-${b.id}" class="mt-10"></div>
          </div>
        `).join("")
            : `<div class="empty">No matching buyers found.</div>`
        }
      </div>
    </div>
  `;
}

export function buyerFormHtml(b = {}, edit = false, id = "") {
  return `
    <form id="${edit ? `buyer-edit-form-${id}` : "buyer-form"}" class="item mb-12">
      <div class="form-header">${edit ? "Edit Buyer" : "New Buyer"}</div>
      <div class="grid gap-10">

        <div class="grid grid-2 gap-10">
          <div>
            <label class="form-label">Buyer Name</label>
            <input name="name" value="${esc(b.name || "")}" placeholder="Buyer name" required>
          </div>
          <div>
            <label class="form-label">Email</label>
            <input name="email" type="email" value="${esc(b.email || "")}" placeholder="Email">
          </div>
        </div>

        <div>
          <label class="form-label">Address</label>
          <textarea name="address" placeholder="Address" class="min-h-80">${esc(b.address || "")}</textarea>
        </div>

        <div class="grid grid-2 gap-10">
          <div>
            <label class="form-label">GST</label>
            <input name="gst" value="${esc(b.gst || "")}" placeholder="GST">
          </div>
          <div>
            <label class="form-label">IEC</label>
            <input name="iec" value="${esc(b.iec || "")}" placeholder="IEC">
          </div>
        </div>

        <div class="grid grid-2 gap-10">
          <div>
            <label class="form-label">PAN</label>
            <input name="pan" value="${esc(b.pan || "")}" placeholder="PAN">
          </div>
          <div>
            <label class="form-label">Customer ID</label>
            <input
              name="customer_id"
              type="number"
              inputmode="numeric"
              min="1"
              step="1"
              value="${esc(b.customer_id || (edit ? "" : nextCustomerId()))}"
              placeholder="Customer ID"
            >
          </div>
        </div>

        <div>
          <label class="form-label">Phone</label>
          <input name="phone" value="${esc(b.phone || "")}" placeholder="Phone">
        </div>

        <div class="flex gap-10">
          <button type="submit" class="btn-primary">${edit ? "Update Buyer" : "Save Buyer"}</button>
          <button type="button" id="${edit ? `cancel-buyer-edit-${id}` : "cancel-buyer-form"}">Cancel</button>
        </div>
      </div>
    </form>
  `;
}
