import { state } from "./state.js";
import { esc } from "./utils.js";

export function productsView() {
  return `
    <div class="grid">
      <h2 class="title">PRODUCTS</h2>
      
      <div class="card">
        <form id="product-form" class="grid gap-12">
          <input name="name" placeholder="Product Name" required>
          <input name="hsn_code" placeholder="HSN Code">
          <button type="submit" class="btn-primary">ADD PRODUCT</button>
        </form>
      </div>

      <div class="list mt-12">
        ${state.products.map(p => `
          <div class="item">
            <div class="flex-between">
              <div>
                <div class="item-title">${esc(p.name)}</div>
                <div class="item-sub">HSN: ${esc(p.hsn_code || "—")}</div>
              </div>
              <div class="flex gap-10">
                <button data-edit-product="${p.id}" class="btn-outline btn-small">EDIT</button>
                <button data-delete-product="${p.id}" class="btn-danger btn-small">DELETE</button>
              </div>
            </div>
            <div id="product-edit-wrap-${p.id}"></div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

export function productEditFormHtml(p) {
  return `
    <form id="product-edit-form-${p.id}" class="grid gap-10 mt-10" style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px">
      <input name="name" value="${esc(p.name)}" placeholder="Product Name" required>
      <input name="hsn_code" value="${esc(p.hsn_code || "")}" placeholder="HSN Code">
      <div class="flex gap-10">
        <button type="submit" class="btn-primary btn-small">UPDATE</button>
        <button type="button" id="cancel-product-edit-${p.id}" class="btn-outline btn-small">CANCEL</button>
      </div>
    </form>
  `;
}
