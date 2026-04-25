import { state } from "./state.js";
import { esc, nextCustomerId } from "./utils.js";

export function buyersView() {
  const q = state.buyerSearch.trim().toLowerCase();
  const filteredBuyers = state.buyers.filter((b) => {
    if (!q) return true;
    const text = [b.name, b.email, b.address, b.gst, b.iec, b.customer_id, b.phone].join(" ").toLowerCase();
    return text.includes(q);
  });

  return `
    <div class="fade-in">
      <div class="flex justify-between items-center mb-24">
        <h1 style="font-size: 24px; font-weight: 800;">Buyers & Clients</h1>
        <button id="show-buyer-form" class="btn btn-primary">+ Add New Buyer</button>
      </div>

      <div class="search-container">
        <span style="position: absolute; left: 16px; top: 14px; opacity: 0.5;">🔍</span>
        <input id="buyer-search" class="search-input" value="${esc(state.buyerSearch || "")}" placeholder="Search buyers by name, GST, IEC or ID..." />
      </div>

      <div id="buyer-form-wrap"></div>

      <div class="grid grid-2">
        ${filteredBuyers.length ? filteredBuyers.map((b) => `
          <div class="card item">
            <div class="flex justify-between items-start">
              <div style="flex: 1; min-width: 0;">
                <div class="item-title" style="font-size: 16px; color: var(--primary);">${esc(b.name || "—")}</div>
                <div class="item-sub" style="font-size: 13px; margin-top: 4px;">${esc(b.address || "—")}</div>
                
                <div class="grid grid-2 mt-12 gap-8">
                  <div>
                    <span class="stat-label" style="font-size: 9px;">GST / TAX</span>
                    <div class="item-sub" style="color: var(--text-main)">${esc(b.gst || "—")}</div>
                  </div>
                  <div>
                    <span class="stat-label" style="font-size: 9px;">IEC / PAN</span>
                    <div class="item-sub" style="color: var(--text-main)">${esc(b.iec || "—")} / ${esc(b.pan || "—")}</div>
                  </div>
                  <div>
                    <span class="stat-label" style="font-size: 9px;">Customer ID</span>
                    <div class="item-sub" style="color: var(--text-main)">#${esc(b.customer_id || "—")}</div>
                  </div>
                  <div>
                    <span class="stat-label" style="font-size: 9px;">Contact</span>
                    <div class="item-sub" style="color: var(--text-main)">${esc(b.phone || b.email || "—")}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="mt-16 flex gap-8 pt-16" style="border-top: 1px solid var(--border);">
              <button data-edit-buyer="${b.id}" class="btn btn-outline btn-small w-full">Edit Details</button>
              <button data-delete-buyer="${b.id}" class="btn btn-logout btn-small">Delete</button>
            </div>
            <div id="buyer-edit-wrap-${b.id}" class="mt-10"></div>
          </div>
        `).join("") : `<div class="empty card">No matching buyers found.</div>`}
      </div>
    </div>
  `;
}

export function buyerFormHtml(b = {}, edit = false, id = "") {
  return `
    <div class="card mb-24 fade-in" style="border: 1px solid var(--primary);">
      <h3 class="section-title">${edit ? "Edit Buyer Profile" : "Create New Buyer"}</h3>
      <form id="${edit ? `buyer-edit-form-${id}` : "buyer-form"}" class="grid gap-16">
        
        <div class="grid grid-2 gap-16">
          <div class="form-group mb-0">
            <label>Full Name / Company Name</label>
            <input name="name" value="${esc(b.name || "")}" placeholder="Legal name" required>
          </div>
          <div class="form-group mb-0">
            <label>Email Address</label>
            <input name="email" type="email" value="${esc(b.email || "")}" placeholder="billing@company.com">
          </div>
        </div>

        <div class="form-group mb-0">
          <label>Complete Address</label>
          <textarea name="address" placeholder="Registered office address" class="min-h-80">${esc(b.address || "")}</textarea>
        </div>

        <div class="grid grid-3 gap-16">
          <div class="form-group mb-0">
            <label>GST Number</label>
            <input name="gst" value="${esc(b.gst || "")}" placeholder="GSTIN">
          </div>
          <div class="form-group mb-0">
            <label>IEC Number</label>
            <input name="iec" value="${esc(b.iec || "")}" placeholder="Import Export Code">
          </div>
          <div class="form-group mb-0">
            <label>PAN Number</label>
            <input name="pan" value="${esc(b.pan || "")}" placeholder="Permanent Account No">
          </div>
        </div>

        <div class="grid grid-2 gap-16">
          <div class="form-group mb-0">
            <label>Customer ID (Auto-gen)</label>
            <input name="customer_id" type="number" value="${esc(b.customer_id || (edit ? "" : nextCustomerId()))}" placeholder="Unique ID">
          </div>
          <div class="form-group mb-0">
            <label>Phone / Mobile</label>
            <input name="phone" value="${esc(b.phone || "")}" placeholder="+971 ...">
          </div>
        </div>

        <div class="flex gap-12 mt-8">
          <button type="submit" class="btn btn-primary">${edit ? "Update Profile" : "Save Buyer"}</button>
          <button type="button" class="btn btn-outline" id="${edit ? `cancel-buyer-edit-${id}` : "cancel-buyer-form"}">Discard</button>
        </div>
      </form>
    </div>
  `;
}
