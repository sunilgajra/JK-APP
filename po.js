import { state, getShipperOptions, getDealById } from "./state.js";
import { esc } from "./utils.js";
import { supabase } from "./supabase.js";
import { openPrintWindow, buildPO } from "./documents.js";

export function poView() {
  const suppliers = state.suppliers || [];
  const deals = state.deals || [];
  const products = state.products || [];

  return `
    <div class="card">
      <div class="flex flex-between flex-center gap-12 flex-wrap">
        <div class="title mb-0">Purchase Orders</div>
      </div>

      <form id="po-form" class="item mt-12">
        <div class="grid gap-15">
          <div class="grid grid-3 gap-10">
            <div>
              <label class="form-label">PO No.</label>
              <input name="po_no" placeholder="JK/HC/2026/..." required>
            </div>
            <div>
              <label class="form-label">PO Date</label>
              <input type="date" name="po_date" value="${new Date().toISOString().split("T")[0]}" required>
            </div>
            <div>
              <label class="form-label">Link to Deal (Optional)</label>
              <select name="deal_id" id="po-deal-select">
                <option value="">Standalone PO</option>
                ${deals.map(d => `<option value="${d.id}">${esc(d.deal_no)} - ${esc(d.product_name)}</option>`).join("")}
              </select>
            </div>
          </div>

          <div class="grid grid-2 gap-10">
            <div>
              <label class="form-label">Supplier</label>
              <select name="supplier_id" id="po-supplier-select" required>
                <option value="">Select Supplier</option>
                ${suppliers.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="form-label">Product Name</label>
              <select name="product_name" id="po-product-select">
                <option value="">Select Product</option>
                ${products.map(p => `<option value="${esc(p.name)}" data-hsn="${esc(p.hsn_code || "")}">${esc(p.name)}</option>`).join("")}
              </select>
            </div>
          </div>

          <div class="grid grid-4 gap-10">
            <div>
              <label class="form-label">HSN Code</label>
              <input name="hsn_code" id="po-hsn" placeholder="2710...">
            </div>
            <div>
              <label class="form-label">Packing</label>
              <input name="packing" placeholder="Flexi Tank / IBC / Drums">
            </div>
            <div>
              <label class="form-label">Quantity</label>
              <input name="quantity" placeholder="10 FCL / 200 MT">
            </div>
             <div>
              <label class="form-label">Weight</label>
              <input name="weight" placeholder="Approx 200 MT">
            </div>
          </div>

          <div class="grid grid-2 gap-10">
            <div>
              <label class="form-label">Price (e.g. USD 740)</label>
              <input name="price" placeholder="USD 740">
            </div>
            <div>
              <label class="form-label">Incoterm & Port</label>
              <input name="incoterm" placeholder="CFR Nhava Sheva">
            </div>
          </div>

          <div>
            <label class="form-label">Specifications (one per line)</label>
            <textarea name="specifications" class="min-h-90" placeholder="Density: 860-875 ppm\nFlash Point: Above 180°C"></textarea>
          </div>

          <div>
            <label class="form-label">Commercial Terms (one per line)</label>
            <textarea name="commercial_terms" class="min-h-90" placeholder="Loading Condition: Material must be loaded in the same vessel."></textarea>
          </div>

          <div class="flex gap-10">
            <button type="submit" class="btn-primary">Save Purchase Order</button>
          </div>
        </div>
      </form>

      <div class="list mt-20">
        <div class="item-title mb-10">Recent Purchase Orders</div>
        ${(state.purchaseOrders || []).length ? state.purchaseOrders.map(po => `
          <div class="item">
            <div class="flex flex-between flex-center">
              <div>
                <div class="item-title">${esc(po.po_no)} (${esc(po.po_date)})</div>
                <div class="item-sub">Supplier: ${esc(suppliers.find(s => String(s.id) === String(po.supplier_id))?.name || "—")}</div>
                <div class="item-sub">Product: ${esc(po.product_name)} · Qty: ${esc(po.quantity)}</div>
              </div>
              <div class="flex gap-8">
                <button class="btn-primary" data-print-po="${po.id}">Print PO</button>
                <button class="btn-danger btn-small" data-delete-po="${po.id}">Delete</button>
              </div>
            </div>
          </div>
        `).join("") : `<div class="empty">No purchase orders found.</div>`}
      </div>
    </div>
  `;
}

export function bindPOUI() {
  const form = document.getElementById("po-form");
  if (!form) return;

  // Auto-fill from deal
  document.getElementById("po-deal-select")?.addEventListener("change", (e) => {
    const deal = getDealById(e.target.value);
    if (deal) {
      form.elements["supplier_id"].value = deal.supplier_id || "";
      form.elements["product_name"].value = deal.product_name || "";
      form.elements["hsn_code"].value = deal.hsn_code || "";
      form.elements["quantity"].value = deal.quantity + " " + (deal.unit || "MT");
      form.elements["price"].value = (deal.document_currency || "USD") + " " + (deal.purchase_rate || deal.rate || 0);
      form.elements["incoterm"].value = (deal.terms_delivery || "") + " " + (deal.discharge_port || "");
      updatePONumber();
    }
  });

  // Auto-fill HSN from product
  document.getElementById("po-product-select")?.addEventListener("change", (e) => {
    const hsn = e.target.selectedOptions[0]?.dataset.hsn || "";
    if (hsn) form.elements["hsn_code"].value = hsn;
    updatePONumber();
  });

  form.elements["supplier_id"]?.addEventListener("change", updatePONumber);
  form.elements["po_date"]?.addEventListener("change", updatePONumber);

  function updatePONumber() {
    const shipper = (state.company.name || "JK").substring(0, 2).toUpperCase();
    
    const supplierId = form.elements["supplier_id"].value;
    const supplierName = state.suppliers.find(s => String(s.id) === String(supplierId))?.name || "";
    const supplierInitials = supplierName.split(/\s+/).filter(Boolean).map(w => w[0]).join("").toUpperCase();
    
    const rawDate = form.elements["po_date"].value; // YYYY-MM-DD
    let datePart = "";
    if (rawDate) {
      const d = new Date(rawDate);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      datePart = `${day}${month}${year}`;
    }

    const prodName = form.elements["product_name"].value || "";
    const prodInitials = prodName.split(/\s+/).filter(Boolean).map(w => w[0]).join("").toUpperCase();

    // Count existing POs for this supplier to determine sequence
    const existingCount = state.purchaseOrders.filter(p => String(p.supplier_id) === String(supplierId)).length;
    const sequence = String(existingCount + 1).padStart(3, '0');

    const poNo = [shipper, supplierInitials, datePart, prodInitials, sequence].filter(Boolean).join("/");
    form.elements["po_no"].value = poNo;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries(fd);
    
    // Convert textareas to arrays
    data.specifications = data.specifications.split("\n").filter(l => l.trim());
    data.commercial_terms = data.commercial_terms.split("\n").filter(l => l.trim());

    try {
      const { error } = await supabase.from("purchase_orders").insert([data]);
      if (error) throw error;
      
      // Reload and re-render
      const { data: newPOs } = await supabase.from("purchase_orders").select("*").order("id", { ascending: false });
      state.purchaseOrders = newPOs;
      window.dispatchEvent(new CustomEvent("render"));
    } catch (err) {
      alert("Error saving PO: " + err.message + "\n\nPlease ensure the 'purchase_orders' table exists in Supabase.");
    }
  });

  document.querySelectorAll("[data-print-po]").forEach(btn => {
    btn.addEventListener("click", () => {
      const po = state.purchaseOrders.find(x => String(x.id) === String(btn.dataset.printPo));
      if (!po) return;
      const supplier = state.suppliers.find(s => String(s.id) === String(po.supplier_id));
      const html = buildPO(po, supplier, state.company);
      openPrintWindow(html);
    });
  });

  document.querySelectorAll("[data-delete-po]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this Purchase Order?")) return;
      await supabase.from("purchase_orders").delete().eq("id", btn.dataset.deletePo);
      const { data: newPOs } = await supabase.from("purchase_orders").select("*").order("id", { ascending: false });
      state.purchaseOrders = newPOs;
      window.dispatchEvent(new CustomEvent("render"));
    });
  });
}
