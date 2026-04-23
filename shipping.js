import { state, getShipperOptions } from "./state.js";
import { esc } from "./utils.js";

export function shippingInstructionsView() {
  const shippers = getShipperOptions();
  const buyers = state.buyers || [];
  const deals = state.deals || [];
  const suppliers = state.suppliers || [];
  const products = state.products || [];

  return `
    <div class="card">
      <div class="flex flex-between flex-center gap-12 flex-wrap">
        <div class="title mb-0">Shipping Instructions</div>
      </div>

      <form id="shipping-instruction-form" class="item mt-12">
        <div class="grid gap-10">

          <div class="grid grid-4 gap-10">
            <div>
              <label class="form-label">Shipper</label>
              <select name="shipper_index" id="si-shipper">
                <option value="">Select shipper</option>
                ${shippers.map((s, i) => `
                  <option value="${i}">${esc(s.name || "Shipper")} - ${esc(s.mobile || "")}</option>
                `).join("")}
              </select>
            </div>

            <div>
              <label class="form-label">Buyer / Consignee</label>
              <select name="buyer_id" id="si-buyer">
                <option value="">Select buyer</option>
                ${buyers.map((b) => `
                  <option value="${b.id}">${esc(b.name || "Buyer")}</option>
                `).join("")}
              </select>
            </div>

            <div>
              <label class="form-label">Deal</label>
              <select name="deal_id" id="si-deal">
                <option value="">Select deal</option>
                ${deals.map((d) => `
                  <option value="${d.id}">${esc(d.deal_no || "—")} - ${esc(d.product_name || "")}</option>
                `).join("")}
              </select>
            </div>

            <div>
              <label class="form-label">Supplier</label>
              <select name="supplier_id" id="si-supplier">
                <option value="">Select supplier</option>
                ${suppliers.map((s) => `
                  <option value="${s.id}">${esc(s.name || "Supplier")}</option>
                `).join("")}
              </select>
            </div>
          </div>

          <div class="grid grid-2 gap-10">
            <div>
              <label class="form-label">Product</label>
              <select name="product" id="si-product">
                <option value="">Select product</option>
                ${products.map((p) => `
                  <option value="${esc(p.name)}" data-hsn="${esc(p.hsn_code || "")}">
                    ${esc(p.name)}
                  </option>
                `).join("")}
              </select>
            </div>

            <div>
              <label class="form-label">HSN Code</label>
              <input name="hsn_code" id="si-hsn" placeholder="HSN Code">
            </div>
          </div>

          <div>
            <label class="form-label">Free Days Text</label>
            <input name="free_days_text" value="21 FREE DAYS AT POD">
          </div>

          <div>
            <label class="form-label">Detention Text</label>
            <input name="detention_text" value="THEREAFTER USD 25/ DAY/TANK">
          </div>

          <div>
            <label class="form-label">Other Instructions</label>
            <textarea name="other_instructions" class="min-h-90" placeholder="Other instructions"></textarea>
          </div>

          <div class="flex gap-10 flex-wrap">
            <button type="submit" class="btn-primary">Save</button>
            <button type="button" id="download-shipping-instruction">Download</button>
            <button type="button" id="whatsapp-shipping-instruction">Send to WhatsApp</button>
          </div>
        </div>
      </form>
    </div>
  `;
}
