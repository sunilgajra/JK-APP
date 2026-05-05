import { state } from "./state.js";
import { esc } from "./utils.js";
import { supabase } from "./supabase.js";
import { loadSupabaseData } from "./data.js";
import { render } from "./ui.js";

export function shippingInstructionsView() {
  return `
    <div class="card">
      <div class="title mb-12">Shipping Instructions</div>
      <div class="list">
        ${state.shippingInstructions.length ? state.shippingInstructions.map(si => `
          <div class="item">
            <div class="item-title">${esc(si.deal_no)}</div>
            <div class="item-sub">Consignee: ${esc(si.consignee_name)}</div>
            <div class="mt-8">
              <button data-print-si="${si.id}">Print SI</button>
              <button data-delete-si="${si.id}" class="text-danger">Delete</button>
            </div>
          </div>
        `).join("") : `<div class="empty">No shipping instructions found.</div>`}
      </div>
    </div>
  `;
}

export async function deleteShippingInstruction(id) {
  if (confirm("Delete this shipping instruction?")) {
    const { error } = await supabase.from("shipping_instructions").delete().eq("id", id);
    if (error) alert(error.message);
    else await loadSupabaseData();
  }
}
