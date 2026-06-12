import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { loadSupabaseData } from "./data.js";
import { render } from "./ui.js";
import { esc } from "./utils.js";

export function showPaymentForm(dealId) {
  const wrap = document.getElementById(`payment-form-wrap-${dealId}`);
  if (!wrap) return;
  const deal = state.deals.find(d => String(d.id) === String(dealId));
  const dealCurrency = deal?.document_currency || deal?.currency || "AED";

  wrap.innerHTML = `
    <form id="payment-form-${dealId}" class="item">
      <div class="form-header">Add Payment (Deal Currency: ${dealCurrency})</div>
      <div class="grid gap-10">
        <select name="direction"><option value="in">Received (In)</option><option value="out">Sent (Out)</option></select>
        
        <div class="grid grid-2 gap-10">
          <input name="amount" id="p-amount-${dealId}" type="number" step="0.01" placeholder="Amount" required>
          <select name="currency" id="payment-currency-${dealId}">
            <option value="${dealCurrency}">${dealCurrency} (Deal Main)</option>
            <option value="AED" ${dealCurrency === "AED" ? "disabled" : ""}>AED</option>
            <option value="USD" ${dealCurrency === "USD" ? "disabled" : ""}>USD</option>
            <option value="INR">INR</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <input name="currency_other" id="payment-currency-other-${dealId}" placeholder="Specify other currency" style="display:none">
        
        <div id="conv-wrap-${dealId}" style="display:none; background:rgba(255,255,255,0.05); padding:10px; border-radius:4px">
          <div class="item-sub mb-8">Currency Conversion to ${dealCurrency}</div>
          <div class="grid grid-2 gap-10">
            <div>
              <label style="font-size:11px; opacity:0.7">Rate (1 ${dealCurrency} = ?)</label>
              <input name="conversion_rate" id="p-rate-${dealId}" type="number" step="0.000001" value="1">
            </div>
            <div>
              <label style="font-size:11px; opacity:0.7">Converted Amount</label>
              <input id="p-converted-${dealId}" type="text" readonly style="background:rgba(0,0,0,0.2)">
            </div>
          </div>
        </div>

        <select name="method" id="payment-method-${dealId}">
          <option value="Bank">Bank</option>
          <option value="Token">Token</option>
          <option value="Commission">Commission</option>
          <option value="Other">Other</option>
        </select>
        <input name="method_other" id="payment-method-other-${dealId}" placeholder="Specify other payment type" style="display:none">
        
        <input name="payment_date" type="date" value="${new Date().toISOString().split("T")[0]}" required>
        <input name="ref" placeholder="Reference / Note">
        
        <div class="flex gap-10">
          <button type="submit" class="btn-primary">Save Payment</button>
          <button type="button" onclick="this.closest('.item').remove()">Cancel</button>
        </div>
      </div>
    </form>
  `;

  const amountInput = document.getElementById(`p-amount-${dealId}`);
  const currSelect = document.getElementById(`payment-currency-${dealId}`);
  const currOther = document.getElementById(`payment-currency-other-${dealId}`);
  const convWrap = document.getElementById(`conv-wrap-${dealId}`);
  const rateInput = document.getElementById(`p-rate-${dealId}`);
  const convertedInput = document.getElementById(`p-converted-${dealId}`);

  const updateConv = () => {
    const isOther = currSelect.value !== dealCurrency;
    convWrap.style.display = isOther ? "block" : "none";
    
    const amount = Number(amountInput.value || 0);
    const rate = Number(rateInput.value || 1);
    if (rate > 0) {
      convertedInput.value = (amount / rate).toFixed(2);
    }
  };

  currSelect.addEventListener("change", () => {
    currOther.style.display = currSelect.value === "Other" ? "block" : "none";
    currOther.required = currSelect.value === "Other";
    updateConv();
  });
  
  amountInput.addEventListener("input", updateConv);
  rateInput.addEventListener("input", updateConv);

  const methodSelect = document.getElementById(`payment-method-${dealId}`);
  const methodOther = document.getElementById(`payment-method-other-${dealId}`);
  methodSelect.addEventListener("change", () => {
    methodOther.style.display = methodSelect.value === "Other" ? "block" : "none";
    methodOther.required = methodSelect.value === "Other";
  });

  document.getElementById(`payment-form-${dealId}`).addEventListener("submit", (e) => savePayment(e, dealId));
}

export async function savePayment(e, dealId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const deal = state.deals.find(d => String(d.id) === String(dealId));
  const dealCurrency = deal?.document_currency || deal?.currency || "AED";
  
  let method = fd.get("method");
  if (method === "Other") method = fd.get("method_other");

  let currency = fd.get("currency");
  if (currency === "Other") currency = fd.get("currency_other");

  const amount = Number(fd.get("amount"));
  const rate = Number(fd.get("conversion_rate") || 1);
  const convertedAmount = currency === dealCurrency ? amount : amount / rate;

  const { error } = await supabase.from("payments").insert({
    deal_id: dealId,
    amount: amount,
    direction: fd.get("direction"),
    payment_date: fd.get("payment_date"),
    method: method,
    currency: currency,
    conversion_rate: rate,
    converted_amount: Number(convertedAmount.toFixed(2)),
    ref: fd.get("ref"),
    status: "completed"
  });

  if (error) alert(error.message);
  else {
    await loadSupabaseData();
    render();
  }
}

export async function deletePayment(val) {
  const parts = val.split(":");
  const paymentId = parts.length > 1 ? parts[1] : parts[0];
  
  if (confirm("Delete payment?")) {
    const { error } = await supabase.from("payments").delete().eq("id", paymentId);
    if (error) alert(error.message);
    else {
      await loadSupabaseData();
      render();
    }
  }
}

export function showEditPaymentForm(val) {
  const [dealId, paymentId] = val.split(":");
  const wrap = document.getElementById(`payment-edit-wrap-${paymentId}`);
  if (!wrap) return;
  
  const deal = state.deals.find(d => String(d.id) === String(dealId));
  const p = (state.paymentsByDeal[dealId] || []).find(x => String(x.id) === String(paymentId));
  if (!p || !deal) return;
  
  const dealCurrency = deal.document_currency || deal.currency || "AED";

  wrap.innerHTML = `
    <form id="payment-edit-form-${paymentId}" class="item" style="background:rgba(255,255,255,0.05); padding:10px; border-radius:4px">
      <div class="form-header">Edit Payment</div>
      <div class="grid gap-10">
        <select name="direction">
          <option value="in" ${p.direction === "in" ? "selected" : ""}>Received (In)</option>
          <option value="out" ${p.direction === "out" ? "selected" : ""}>Sent (Out)</option>
        </select>
        
        <div class="grid grid-2 gap-10">
          <input name="amount" id="pe-amount-${paymentId}" type="number" step="0.01" value="${p.amount}" required>
          <select name="currency" id="pe-currency-${paymentId}">
            <option value="AED" ${p.currency === "AED" ? "selected" : ""}>AED</option>
            <option value="USD" ${p.currency === "USD" ? "selected" : ""}>USD</option>
            <option value="INR" ${p.currency === "INR" ? "selected" : ""}>INR</option>
            <option value="Other" ${!["AED","USD","INR"].includes(p.currency) ? "selected" : ""}>Other</option>
          </select>
        </div>
        <input name="currency_other" id="pe-currency-other-${paymentId}" value="${!["AED","USD","INR"].includes(p.currency) ? p.currency : ""}" placeholder="Specify currency" style="display:${!["AED","USD","INR"].includes(p.currency) ? "block" : "none"}">
        
        <div id="pe-conv-wrap-${paymentId}" style="display:${p.currency !== dealCurrency ? "block" : "none"}; background:rgba(0,0,0,0.1); padding:10px; border-radius:4px">
          <div class="item-sub mb-8">Conversion to ${dealCurrency}</div>
          <div class="grid grid-2 gap-10">
            <div>
              <label style="font-size:11px; opacity:0.7">Rate</label>
              <input name="conversion_rate" id="pe-rate-${paymentId}" type="number" step="0.000001" value="${p.conversion_rate || 1}">
            </div>
            <div>
              <label style="font-size:11px; opacity:0.7">Converted</label>
              <input id="pe-converted-${paymentId}" type="text" readonly value="${(p.converted_amount !== null && p.converted_amount !== undefined ? p.converted_amount : p.amount).toFixed(2)}" style="background:transparent; border:none">
            </div>
          </div>
        </div>

        <select name="method" id="pe-method-${paymentId}">
          <option value="Bank" ${p.method === "Bank" ? "selected" : ""}>Bank</option>
          <option value="Token" ${p.method === "Token" ? "selected" : ""}>Token</option>
          <option value="Commission" ${p.method === "Commission" ? "selected" : ""}>Commission</option>
          <option value="Other" ${!["Bank","Token","Commission"].includes(p.method) ? "selected" : ""}>Other</option>
        </select>
        <input name="method_other" id="pe-method-other-${paymentId}" value="${!["Bank","Token"].includes(p.method) ? p.method : ""}" placeholder="Specify method" style="display:${!["Bank","Token"].includes(p.method) ? "block" : "none"}">
        
        <input name="payment_date" type="date" value="${p.payment_date}" required>
        <input name="ref" value="${esc(p.ref || "")}" placeholder="Reference">
        
        <div class="flex gap-10">
          <button type="submit" class="btn-primary btn-small">Update</button>
          <button type="button" class="btn-small" onclick="this.closest('form').remove()">Cancel</button>
        </div>
      </div>
    </form>
  `;

  const form = document.getElementById(`payment-edit-form-${paymentId}`);
  const amountIn = form.querySelector("[name='amount']");
  const currIn = form.querySelector("[name='currency']");
  const rateIn = form.querySelector("[name='conversion_rate']");
  const convOut = document.getElementById(`pe-converted-${paymentId}`);
  
  const update = () => {
    const isConv = currIn.value !== dealCurrency;
    document.getElementById(`pe-conv-wrap-${paymentId}`).style.display = isConv ? "block" : "none";
    const amount = Number(amountIn.value || 0);
    const rate = Number(rateIn.value || 1);
    if (rate > 0) convOut.value = (amount / rate).toFixed(2);
  };

  currIn.addEventListener("change", () => {
    const other = document.getElementById(`pe-currency-other-${paymentId}`);
    other.style.display = currIn.value === "Other" ? "block" : "none";
    update();
  });
  amountIn.addEventListener("input", update);
  rateIn.addEventListener("input", update);
  form.querySelector("[name='method']").addEventListener("change", (e) => {
    form.querySelector("[name='method_other']").style.display = e.target.value === "Other" ? "block" : "none";
  });

  form.addEventListener("submit", (e) => updatePayment(e, dealId, paymentId));
}

export async function updatePayment(e, dealId, paymentId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const deal = state.deals.find(d => String(d.id) === String(dealId));
  const dealCurrency = deal?.document_currency || deal?.currency || "AED";

  let method = fd.get("method");
  if (method === "Other") method = fd.get("method_other");

  let currency = fd.get("currency");
  if (currency === "Other") currency = fd.get("currency_other");

  const amount = Number(fd.get("amount"));
  const rate = Number(fd.get("conversion_rate") || 1);
  const convertedAmount = currency === dealCurrency ? amount : Math.round((amount / rate + Number.EPSILON) * 100) / 100;

  const { error } = await supabase.from("payments").update({
    amount: amount,
    direction: fd.get("direction"),
    payment_date: fd.get("payment_date"),
    method: method,
    currency: currency,
    conversion_rate: rate,
    converted_amount: convertedAmount,
    ref: fd.get("ref")
  }).eq("id", paymentId);

  if (error) alert(error.message);
  else {
    await loadSupabaseData();
    render();
  }
}
