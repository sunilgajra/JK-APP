import { state } from "./state.js";
import { esc } from "./utils.js";

export function productsView() {
  return `
    <div class="card">
      <div class="title mb-12">Products</div>

      <form id="product-form" class="item mb-12">
        <div class="grid gap-10" style="grid-template-columns:1fr 1fr auto;align-items:end">
          <div>
            <label class="form-label">Product Name</label>
            <input name="name" placeholder="Product name" required>
          </div>

          <div>
            <label class="form-label">HSN Code</label>
            <input name="hsn_code" placeholder="HSN Code">
          </div>

          <button type="submit" class="btn-primary">Save Product</button>
        </div>
      </form>

      <div class="list">
        ${
          state.products.length
            ? state.products.map((p) => `
              <div class="item">
                <div class="item-title">${esc(p.name || "—")}</div>
                <div class="item-sub">HSN: ${esc(p.hsn_code || "—")}</div>

                <div class="mt-8 flex gap-8">
                  <button data-edit-product="${p.id}">Edit</button>
                  <button data-delete-product="${p.id}">Delete</button>
                </div>

                <div id="product-edit-wrap-${p.id}" class="mt-10"></div>
              </div>
            `).join("")
            : `<div class="empty">No products saved yet.</div>`
        }
      </div>
    </div>
  `;
}

export function productEditFormHtml(p = {}) {
  return `
    <form data-product-edit-form="${p.id}" class="item">
      <div class="grid gap-10" style="grid-template-columns:1fr 1fr auto auto;align-items:end">
        <div>
          <label class="form-label">Product Name</label>
          <input name="name" value="${esc(p.name || "")}" required>
        </div>

        <div>
          <label class="form-label">HSN Code</label>
          <input name="hsn_code" value="${esc(p.hsn_code || "")}">
        </div>

        <button type="submit" class="btn-primary">Update</button>
        <button type="button" data-cancel-product-edit="${p.id}">Cancel</button>
      </div>
    </form>
  `;
}
