import { state } from "./state.js";
import { esc, nextCustomerId } from "./utils.js";

export function buyersView() {
  const q = (state.buyerSearch || "").toLowerCase();
  const filtered = state.buyers.filter(b => {
    const text = `${b.name} ${b.customer_id} ${b.gst} ${b.iec}`.toLowerCase();
    return text.includes(q);
  });

  return `
    <div class="grid">
      <div class="flex-between flex-center">
        <h2 class="title">BUYERS & CLIENTS</h2>
        <button id="show-buyer-form" class="btn-primary">+ NEW BUYER</button>
      </div>

      <div id="buyer-form-wrap"></div>

      <input id="buyer-search" value="${esc(state.buyerSearch || "")}" placeholder="Search buyers...">

      <div class="list">
        ${filtered.map(b => `
          <div class="item">
            <div class="flex-between">
              <div>
                <div class="item-title">${esc(b.name)} (#${esc(b.customer_id)})</div>
                <div class="item-sub">${esc(b.address || "No address")}</div>
              </div>
              <div class="flex gap-10">
                <button data-edit-buyer="${b.id}" class="btn-outline btn-small">EDIT</button>
                <button data-delete-buyer="${b.id}" class="btn-danger btn-small">DELETE</button>
              </div>
            </div>
            <div id="buyer-edit-wrap-${b.id}"></div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

export function buyerFormHtml(b = {}, edit = false, id = "") {
  return `
    <form id="${edit ? `buyer-edit-form-${id}` : "buyer-form"}" class="item mb-12">
      <div class="form-header">${edit ? "EDIT BUYER" : "NEW BUYER"}</div>
      <div class="grid gap-12">
        <div class="grid grid-2 gap-10">
          <input name="name" value="${esc(b.name || "")}" placeholder="Buyer Name" required>
          <input name="customer_id" value="${esc(b.customer_id || nextCustomerId())}" placeholder="Customer ID" required>
        </div>
        <textarea name="address" placeholder="Full Address">${esc(b.address || "")}</textarea>
        <div class="grid grid-2 gap-10">
          <input name="gst" value="${esc(b.gst || "")}" placeholder="GST / TAX ID">
          <input name="iec" value="${esc(b.iec || "")}" placeholder="IEC / PAN">
        </div>
        <div class="grid grid-2 gap-10">
          <input name="phone" value="${esc(b.phone || "")}" placeholder="Phone">
          <input name="email" type="email" value="${esc(b.email || "")}" placeholder="Email">
        </div>
        <div class="flex gap-10">
          <button type="submit" class="btn-primary">${edit ? "UPDATE" : "SAVE"}</button>
          <button type="button" id="${edit ? `cancel-buyer-edit-${id}` : "cancel-buyer-form"}">CANCEL</button>
        </div>
      </div>
    </form>
  `;
}
