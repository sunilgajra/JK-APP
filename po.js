import { state, supplierName } from "./state.js";
import { esc, fmtMoney, monthSuffix } from "./utils.js";
import { supabase } from "./supabase.js";
import { loadSupabaseData } from "./data.js";
import { render } from "./ui.js";

export function poView() {
  const q = (state.poSearch || "").trim().toLowerCase();
  const filtered = state.pos.filter(p => {
    if (!q) return true;
    const text = [p.po_no, supplierName(p.supplier_id), p.product].join(" ").toLowerCase();
    return text.includes(q);
  });

  return `
    <div class="card">
      <div class="flex flex-between flex-center mb-12">
        <div class="title mb-0">Purchase Orders (PO)</div>
        <button id="show-po-form" class="btn-primary">Create New PO</button>
      </div>

      <div class="mb-12">
        <input id="po-search" value="${esc(state.poSearch || "")}" placeholder="Search POs by Number, Supplier, Product...">
      </div>

      <div id="po-form-wrap"></div>

      <div class="list mt-12">
        ${filtered.length ? filtered.map(p => `
          <div class="item">
            <div class="flex flex-between flex-center">
              <div>
                <div class="item-title">${esc(p.po_no)}</div>
                <div class="item-sub">Supplier: <strong>${esc(supplierName(p.supplier_id))}</strong></div>
                <div class="item-sub">Product: ${esc(p.product)} (${esc(p.quantity)} ${esc(p.unit)})</div>
              </div>
              <div class="flex gap-8">
                <button data-print-po="${p.id}" class="btn-info">Print PO</button>
                <button data-edit-po="${p.id}">Edit</button>
                <button data-delete-po="${p.id}" class="text-danger">Delete</button>
              </div>
            </div>
            <div id="po-edit-wrap-${p.id}" class="mt-10"></div>
          </div>
        `).join("") : `<div class="empty">No POs found.</div>`}
      </div>
    </div>
  `;
}

export function poFormHtml(p = {}, edit = false, id = "") {
  return `
    <form id="${edit ? `po-edit-form-${id}` : "po-form"}" class="item mb-12">
      <div class="form-header">${edit ? "Edit PO" : "New PO"}</div>
      <div class="grid grid-2 gap-10">
        <div>
          <label class="form-label">PO Number</label>
          <input name="po_no" value="${esc(p.po_no || nextPoNo())}" required>
        </div>
        <div>
          <label class="form-label">Date</label>
          <input name="date" type="date" value="${p.date || new Date().toISOString().split("T")[0]}" required>
        </div>
        <div>
          <label class="form-label">Supplier</label>
          <select name="supplier_id" required>
            <option value="">Select Supplier</option>
            ${state.suppliers.map(s => `<option value="${s.id}" ${String(s.id) === String(p.supplier_id) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="form-label">Product</label>
          <input name="product" value="${esc(p.product || "")}" required>
        </div>
        <div>
          <label class="form-label">Quantity</label>
          <input name="quantity" type="number" step="0.01" value="${p.quantity || ""}" required>
        </div>
        <div>
          <label class="form-label">Unit</label>
          <input name="unit" value="${esc(p.unit || "MTON")}" required>
        </div>
        <div>
          <label class="form-label">Rate (USD)</label>
          <input name="rate" type="number" step="0.01" value="${p.rate || ""}" required>
        </div>
        <div>
          <label class="form-label">Total (USD)</label>
          <input name="total" type="number" step="0.01" value="${p.total || ""}" required>
        </div>
      </div>
      <div class="mt-10">
        <label class="form-label">Terms / Notes</label>
        <textarea name="terms" style="min-height:80px">${esc(p.terms || "")}</textarea>
      </div>
      <div class="flex gap-10 mt-10">
        <button type="submit" class="btn-primary">${edit ? "Update" : "Save"}</button>
        <button type="button" id="${edit ? `cancel-po-edit-${id}` : "cancel-po-form"}">Cancel</button>
      </div>
    </form>
  `;
}

function nextPoNo() {
  const mm = monthSuffix();
  const nums = state.pos.map(p => String(p.po_no || "").match(/PO-(\d+)\/\d{2}/)).filter(Boolean).map(m => Number(m[1]));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `PO-${String(next).padStart(3, "0")}/${mm}`;
}

export function bindPOUI() {
  document.getElementById("show-po-form")?.addEventListener("click", () => {
    const wrap = document.getElementById("po-form-wrap");
    wrap.innerHTML = poFormHtml();
    document.getElementById("po-form").addEventListener("submit", savePO);
    document.getElementById("cancel-po-form").addEventListener("click", () => wrap.innerHTML = "");
  });

  document.getElementById("po-search")?.addEventListener("input", (e) => {
    state.poSearch = e.target.value;
    render();
  });

  document.querySelectorAll("[data-print-po]").forEach(btn => btn.addEventListener("click", () => {
     // Print logic...
  }));

  document.querySelectorAll("[data-edit-po]").forEach(btn => btn.addEventListener("click", () => {
    const id = btn.dataset.editPo;
    const p = state.pos.find(x => String(x.id) === String(id));
    const wrap = document.getElementById(`po-edit-wrap-${id}`);
    wrap.innerHTML = poFormHtml(p, true, id);
    document.getElementById(`po-edit-form-${id}`).addEventListener("submit", (e) => updatePO(e, id));
    document.getElementById(`cancel-po-edit-${id}`).addEventListener("click", () => wrap.innerHTML = "");
  }));

  document.querySelectorAll("[data-delete-po]").forEach(btn => btn.addEventListener("click", () => deletePO(btn.dataset.deletePo)));
}

export async function savePO(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd);
  const { error } = await supabase.from("purchase_orders").insert(payload);
  if (error) alert(error.message);
  else await loadSupabaseData();
}

export async function updatePO(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd);
  const { error } = await supabase.from("purchase_orders").update(payload).eq("id", id);
  if (error) alert(error.message);
  else await loadSupabaseData();
}

export async function deletePO(id) {
  if (confirm("Delete PO?")) {
    const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
    if (error) alert(error.message);
    else await loadSupabaseData();
  }
}
