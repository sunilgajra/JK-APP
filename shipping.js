import { state, getBuyerById, getDealById, getShipperOptions } from "./state.js";
import { esc, cleanUpper } from "./utils.js";

export function shippingInstructionsView() {
  return `
    <div class="grid">
      <h2 class="title">SHIPPING INSTRUCTIONS</h2>
      
      <div class="card">
        <form id="shipping-instruction-form" class="grid gap-12">
          <select name="deal_id" id="si-deal-select" required>
            <option value="">Select Deal</option>
            ${state.deals.map(d => `<option value="${d.id}">${esc(d.deal_no)}: ${esc(d.product_name)}</option>`).join("")}
          </select>
          
          <div class="grid grid-2 gap-10">
            <input name="bl_no" id="si-bl" placeholder="BL No">
            <input name="booking_no" id="si-booking" placeholder="Booking No">
          </div>

          <textarea name="instructions" id="si-text" style="min-height:200px" placeholder="Enter instructions here..."></textarea>
          
          <div class="flex gap-10">
            <button type="submit" class="btn-primary">SAVE SI</button>
          </div>
        </form>
      </div>

      <div class="list mt-12">
        ${(state.shippingInstructions || []).map(si => `
          <div class="item">
            <div class="flex-between">
              <div>
                <div class="item-title">SI: ${esc(si.bl_no || "N/A")}</div>
                <div class="item-sub">${new Date(si.created_at).toLocaleString()}</div>
              </div>
              <button data-delete-si="${si.id}" class="btn-danger btn-small">X</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

export function bindShippingInstructionForm() {
  // logic to bind si form
}
