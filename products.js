import { state } from "./state.js";
import { esc } from "./utils.js";
import { supabase } from "./supabase.js";
import { loadProducts } from "./data.js";
import { render } from "./ui.js";

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
    <form id="product-edit-form-${p.id}" class="item">
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
        <button type="button" id="cancel-product-edit-${p.id}">Cancel</button>
      </div>
    </form>
  `;
}

// Product Logic
export async function saveProduct(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const name = String(fd.get("name") || "").trim().toUpperCase();
  const hsn = String(fd.get("hsn_code") || "").trim().toUpperCase();

  const exists = state.products.some(p => 
    String(p.name || "").trim().toUpperCase() === name && 
    String(p.hsn_code || "").trim().toUpperCase() === hsn
  );

  if (exists) return alert("Error: A product with this name and HSN code already exists.");

  const { error } = await supabase.from("products").insert({ name: fd.get("name"), hsn_code: fd.get("hsn_code") });
  if (error) return alert(error.message);
  await loadProducts();
  render();
}

export function showEditProductForm(id) {
  const p = state.products.find(x => String(x.id) === String(id));
  const wrap = document.getElementById(`product-edit-wrap-${id}`);
  if (!p || !wrap) return;
  wrap.innerHTML = productEditFormHtml(p);
  document.getElementById(`product-edit-form-${id}`).addEventListener("submit", (e) => updateProduct(e, id));
  document.getElementById(`cancel-product-edit-${id}`).addEventListener("click", () => wrap.innerHTML = "");
}

export async function updateProduct(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const name = String(fd.get("name") || "").trim().toUpperCase();
  const hsn = String(fd.get("hsn_code") || "").trim().toUpperCase();

  const exists = state.products.some(p => 
    String(p.id) !== String(id) &&
    String(p.name || "").trim().toUpperCase() === name && 
    String(p.hsn_code || "").trim().toUpperCase() === hsn
  );

  if (exists) return alert("Error: Another product with this same name and HSN code already exists.");

  const { error } = await supabase.from("products").update({ name: fd.get("name"), hsn_code: fd.get("hsn_code") }).eq("id", id);
  if (error) return alert(error.message);
  await loadProducts();
  render();
}

export async function deleteProduct(id) {
  if (confirm("Delete product?")) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) alert(error.message);
    else {
      await loadProducts();
      render();
    }
  }
}
