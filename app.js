import { openPrintWindow, buildPI, buildCI, buildPL, buildCOO } from "./documents.js?v=4";
import { supabase } from "./supabase.js";
import { state, buyerName, supplierName, getBuyerById, getDealById, getShipperOptions } from "./state.js";
import { esc, cleanText, cleanUpper, cleanNumber, normalizeCustomerId } from "./utils.js";
import { dashboardView } from "./views/dashboard.js";
import { buyersView, buyerFormHtml } from "./views/buyers.js";
import { suppliersView, supplierFormHtml } from "./views/suppliers.js";
import { dealsView, dealFormHtml } from "./views/deals.js";
import { dealDetailView } from "./views/dealDetail.js";
import { settingsView } from "./views/settings.js";
import { shippingInstructionsView } from "./views/shipping.js";
import { productsView, productEditFormHtml } from "./views/products.js";

const content = document.getElementById("content");

function navigate(path) {
  window.location.hash = path;
}

function handleRoute() {
  const hash = window.location.hash || "#/";

  if (hash.startsWith("#/deals/")) {
    state.selectedDealId = hash.split("/")[2];
    state.page = "dealDetail";
  } else if (hash === "#/buyers") {
    state.page = "buyers";
  } else if (hash === "#/suppliers") {
    state.page = "suppliers";
  } else if (hash === "#/settings") {
    state.page = "settings";
  } else if (hash === "#/deals") {
    state.page = "deals";
  } else if (hash === "#/shipping") {
    state.page = "shippingInstructions";
  } else if (hash === "#/products") {
    state.page = "products";
  } else {
    state.page = "dashboard";
  }

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === state.page);
  });

  render();
}

window.addEventListener("hashchange", handleRoute);

function buildShippingInstructionText(values) {
  const shipper = values.shipper || {};
  const buyer = values.buyer || {};

  const lines = [
    "SHIPPER:",
    shipper.name || "",
    shipper.address || "",
    shipper.mobile ? `TEL: ${shipper.mobile}` : "",
    shipper.email ? `EMAIL: ${shipper.email}` : "",

    "",
    "CONSIGNEE:",
    buyer.name || "",
    buyer.address || "",
    `IEC: ${buyer.iec || ""}`,
    `GST: ${buyer.gst || ""}`,
    `PAN: ${buyer.pan || ""}`,
    `TEL: ${buyer.phone || ""}`,
    `EMAIL: ${buyer.email || ""}`,

    "",
    `PRODUCT: ${values.product || ""}`,
    `HSN CODE: ${values.hsn_code || ""}`,
    values.supplier_name ? `SUPPLIER: ${values.supplier_name}` : "",

    "",
    values.free_days_text || "",
    values.detention_text || "",
    values.other_instructions || ""
  ].filter((line, index, arr) => {
    if (line !== "") return true;
    return arr[index - 1] !== "";
  });

  return lines.join("\n");
}

function downloadShippingInstruction(text, fileName = "shipping-instruction.txt") {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sendShippingInstructionToWhatsApp(text) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}
function bindDealAutoTotal(edit = false, id = "") {
  const qtyEl = document.getElementById(edit ? `quantity-${id}` : "quantity");
  const rateEl = document.getElementById(edit ? `rate-${id}` : "rate");
  const totalEl = document.getElementById(edit ? `total-${id}` : "total");
  const totalAedEl = document.getElementById(edit ? `total-aed-${id}` : "total-aed");
  const convEl = document.getElementById(edit ? `conversion-rate-${id}` : "conversion-rate");
  const baseCurrencyEl = document.getElementById(edit ? `base-currency-${id}` : "base-currency");
  const docCurrencyEl = document.querySelector(
    edit ? `#deal-edit-form-${id} select[name="document_currency"]` : `#deal-form select[name="document_currency"]`
  );
  const totalLabelEl = document.getElementById(edit ? `total-label-${id}` : "total-label");

  if (!qtyEl || !rateEl || !totalEl || !totalAedEl || !baseCurrencyEl || !docCurrencyEl) return;

  function calcTotal() {
    const qty = Number(qtyEl.value || 0);
    const rate = Number(rateEl.value || 0);
    const conv = Number(convEl?.value || 0);
    const baseCurrency = baseCurrencyEl.value || "USD";
    const documentCurrency = docCurrencyEl.value || baseCurrency;

    let totalUsd = 0;
    let totalAed = 0;

    if (baseCurrency === "USD") {
      totalUsd = qty * rate;
      totalAed = conv > 0 ? totalUsd * conv : 0;
    } else {
      totalAed = qty * rate;
      totalUsd = conv > 0 ? totalAed / conv : 0;
    }

    if (documentCurrency === "USD") {
      totalEl.value = totalUsd ? totalUsd.toFixed(2) : "";
    } else {
      totalEl.value = totalAed ? totalAed.toFixed(2) : "";
    }

    totalAedEl.value = totalAed ? totalAed.toFixed(2) : "";

    if (totalLabelEl) {
      totalLabelEl.textContent = `Total (${documentCurrency})`;
    }
  }

  qtyEl.addEventListener("input", calcTotal);
  rateEl.addEventListener("input", calcTotal);
  convEl?.addEventListener("input", calcTotal);
  baseCurrencyEl.addEventListener("change", calcTotal);
  docCurrencyEl.addEventListener("change", calcTotal);

  calcTotal();
}

function bindShippingInstructionForm() {
  const form = document.getElementById("shipping-instruction-form");
  if (!form) return;

  const buyerEl = document.getElementById("si-buyer");
  const dealEl = document.getElementById("si-deal");
  const productEl = document.getElementById("si-product");
  const hsnEl = document.getElementById("si-hsn");

  dealEl?.addEventListener("change", () => {
    const deal = getDealById(dealEl.value);
    if (!deal) return;

    if (productEl && !productEl.value) {
      productEl.value = deal.product_name || "";
      const selectedOption = productEl.options[productEl.selectedIndex];
      const hsn = selectedOption?.dataset?.hsn || deal.hsn_code || "";
      if (hsnEl && !hsnEl.value) hsnEl.value = hsn;
    }

    if (buyerEl && !buyerEl.value && deal.buyer_id) {
      buyerEl.value = String(deal.buyer_id);
    }

    if (hsnEl && !hsnEl.value && deal.hsn_code) {
      hsnEl.value = deal.hsn_code;
    }
  });

  document.getElementById("download-shipping-instruction")?.addEventListener("click", () => {
    const fd = new FormData(form);
    const shipper = getShipperOptions()[Number(fd.get("shipper_index"))] || {};
    const buyer = getBuyerById(fd.get("buyer_id")) || {};
    const supplier = state.suppliers.find((s) => String(s.id) === String(fd.get("supplier_id"))) || {};

    const text = buildShippingInstructionText({
      shipper,
      buyer,
      supplier_name: supplier.name || "",
      product: cleanText(fd.get("product")),
      hsn_code: cleanText(fd.get("hsn_code")),
      free_days_text: cleanText(fd.get("free_days_text")),
      detention_text: cleanText(fd.get("detention_text")),
      other_instructions: cleanText(fd.get("other_instructions"))
    });

    const deal = getDealById(fd.get("deal_id"));
    const fileName = deal?.deal_no ? `${deal.deal_no}-shipping-instruction.txt` : "shipping-instruction.txt";
    downloadShippingInstruction(text, fileName);
  });

  document.getElementById("whatsapp-shipping-instruction")?.addEventListener("click", () => {
    const fd = new FormData(form);
    const shipper = getShipperOptions()[Number(fd.get("shipper_index"))] || {};
    const buyer = getBuyerById(fd.get("buyer_id")) || {};
    const supplier = state.suppliers.find((s) => String(s.id) === String(fd.get("supplier_id"))) || {};

    const text = buildShippingInstructionText({
      shipper,
      buyer,
      supplier_name: supplier.name || "",
      product: cleanText(fd.get("product")),
      hsn_code: cleanText(fd.get("hsn_code")),
      free_days_text: cleanText(fd.get("free_days_text")),
      detention_text: cleanText(fd.get("detention_text")),
      other_instructions: cleanText(fd.get("other_instructions"))
    });

    sendShippingInstructionToWhatsApp(text);
  });

  form.addEventListener("submit", saveShippingInstruction);
}
async function loginUser(e) {
  e.preventDefault();
  const fd = new FormData(e.target);

  const email = String(fd.get("email") || "").trim();
  const password = String(fd.get("password") || "").trim();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert(error.message);
    return;
  }

  state.authUser = data.user || null;
  await loadSupabaseData();
}
async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    alert(error.message);
    return;
  }

  state.authUser = null;
  render();
}
async function loadSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error(error);
    return;
  }

  state.authUser = data.session?.user || null;

  if (state.authUser) {
    await loadSupabaseData();
  } else {
    render();
  }
}
async function saveShippingInstruction(e) {
  e.preventDefault();

  const fd = new FormData(e.target);
  const supplier = state.suppliers.find((s) => String(s.id) === String(fd.get("supplier_id")));

  const payload = {
    shipper_index: cleanText(fd.get("shipper_index")) === "" ? null : Number(fd.get("shipper_index")),
    buyer_id: cleanText(fd.get("buyer_id")) === "" ? null : Number(fd.get("buyer_id")),
    supplier_id: cleanText(fd.get("supplier_id")) === "" ? null : Number(fd.get("supplier_id")),
    supplier_name: supplier?.name || "",
    deal_id: cleanText(fd.get("deal_id")) === "" ? null : Number(fd.get("deal_id")),
    product: cleanText(fd.get("product")),
    hsn_code: cleanText(fd.get("hsn_code")),
    free_days_text: cleanText(fd.get("free_days_text")),
    detention_text: cleanText(fd.get("detention_text")),
    other_instructions: cleanText(fd.get("other_instructions"))
  };

  const { error } = await supabase.from("shipping_instructions").insert(payload);
  if (error) return alert(error.message);

  alert("Shipping instruction saved successfully ✅");
  await loadShippingInstructions();
}
async function loadShippingInstructions() {
  const { data, error } = await supabase
    .from("shipping_instructions")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  state.shippingInstructions = data || [];
}
async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  state.products = data || [];
}

async function saveProduct(e) {
  e.preventDefault();
  const fd = new FormData(e.target);

  const payload = {
    name: cleanText(fd.get("name")),
    hsn_code: cleanText(fd.get("hsn_code"))
  };

  const { error } = await supabase.from("products").insert(payload);
  if (error) return alert(error.message);

  alert("Product saved successfully ✅");
  e.target.reset();
  await loadProducts();
  render();
}

function showEditProductForm(id) {
  const product = state.products.find((p) => String(p.id) === String(id));
  const wrap = document.getElementById(`product-edit-wrap-${id}`);
  if (!product || !wrap) return;

  wrap.innerHTML = productEditFormHtml(product);

  wrap.querySelector(`[data-product-edit-form="${id}"]`)?.addEventListener("submit", (e) => updateProduct(e, id));
  wrap.querySelector(`[data-cancel-product-edit="${id}"]`)?.addEventListener("click", () => {
    wrap.innerHTML = "";
  });
}

async function updateProduct(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);

  const payload = {
    name: cleanText(fd.get("name")),
    hsn_code: cleanText(fd.get("hsn_code"))
  };

  const { error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", id);

  if (error) return alert(error.message);

  alert("Product updated successfully ✅");
  await loadProducts();
  render();
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id);

  if (error) return alert(error.message);

  await loadProducts();
  render();
}
function bindProductSelectors() {
  const productSelectors = document.querySelectorAll('select[name="product_name"], select[name="product"]');

  productSelectors.forEach((select) => {
    select.addEventListener("change", () => {
      const form = select.closest("form");
      if (!form) return;

      const hsnInput = form.querySelector('input[name="hsn_code"]');
      if (!hsnInput) return;

      const selectedOption = select.options[select.selectedIndex];
      const hsn = selectedOption?.getAttribute("data-hsn") || "";

      hsnInput.value = hsn;
    });
  });
}
function render() {
  if (!state.authUser) {
    content.innerHTML = loginView();
    bindUI();
    return;
  }

  if (state.page === "dashboard") content.innerHTML = dashboardView();
  if (state.page === "buyers") content.innerHTML = buyersView();
  if (state.page === "suppliers") content.innerHTML = suppliersView();
  if (state.page === "deals") content.innerHTML = dealsView();
  if (state.page === "dealDetail") content.innerHTML = dealDetailView();
  if (state.page === "shippingInstructions") content.innerHTML = shippingInstructionsView();
  if (state.page === "products") content.innerHTML = productsView();
  if (state.page === "settings") content.innerHTML = settingsView();
  bindUI();
}

function bindUI() {
  document.getElementById("login-form")?.addEventListener("submit", loginUser);
  document.getElementById("logout-btn")?.addEventListener("click", logoutUser);
  document.getElementById("show-buyer-form")?.addEventListener("click", showBuyerForm);
  document.getElementById("show-supplier-form")?.addEventListener("click", showSupplierForm);
  document.getElementById("show-deal-form")?.addEventListener("click", showDealForm);
  document.getElementById("back-to-deals")?.addEventListener("click", () => navigate("#/deals"));
  document.getElementById("open-company-settings")?.addEventListener("click", () => navigate("#/settings"));
  document.getElementById("company-settings-form")?.addEventListener("submit", saveCompanySettings);
  document.getElementById("add-bank-btn")?.addEventListener("click", addBankAccount);
  document.getElementById("add-shipper-btn")?.addEventListener("click", addShipper);
  document.getElementById("export-deals-csv")?.addEventListener("click", exportDealsCsv);
  document.getElementById("product-form")?.addEventListener("submit", saveProduct);

  document.querySelectorAll("[data-delete-bank]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.deleteBank);
      state.company.bankAccounts.splice(index, 1);
      render();
    });
  });

  document.querySelectorAll("[data-delete-shipper]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.deleteShipper);
      state.company.shippers.splice(index, 1);
      render();
    });
  });

  document.getElementById("deal-search")?.addEventListener("input", (e) => {
    state.dealSearch = e.target.value;
    render();
  });

  document.getElementById("buyer-search")?.addEventListener("input", (e) => {
    state.buyerSearch = e.target.value;
    render();
  });

  document.getElementById("supplier-search")?.addEventListener("input", (e) => {
    state.supplierSearch = e.target.value;
    render();
  });

  document.querySelectorAll("[data-open-deal]").forEach((btn) =>
    btn.addEventListener("click", () => {
      navigate("#/deals/" + btn.dataset.openDeal);
    })
  );

  document.querySelectorAll("[data-show-payment-form]").forEach((btn) =>
    btn.addEventListener("click", () => showPaymentForm(btn.dataset.showPaymentForm))
  );

  document.querySelectorAll("[data-delete-payment]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const [dealId, paymentId] = btn.dataset.deletePayment.split(":");
      deletePayment(dealId, paymentId);
    })
  );

  document.querySelectorAll("[data-placeholder-upload]").forEach((form) => {
    form.addEventListener("submit", (e) => savePlaceholderDocument(e, form.dataset.placeholderUpload));
  });

  document.querySelectorAll("[data-delete-placeholder-doc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [dealId, index] = btn.dataset.deletePlaceholderDoc.split(":");
      deletePlaceholderDocument(dealId, Number(index));
    });
  });

  document.querySelectorAll("[data-edit-buyer]").forEach((btn) =>
    btn.addEventListener("click", () => showEditBuyerForm(btn.dataset.editBuyer))
  );

  document.querySelectorAll("[data-delete-buyer]").forEach((btn) =>
    btn.addEventListener("click", () => deleteBuyer(btn.dataset.deleteBuyer))
  );

  document.querySelectorAll("[data-edit-supplier]").forEach((btn) =>
    btn.addEventListener("click", () => showEditSupplierForm(btn.dataset.editSupplier))
  );

  document.querySelectorAll("[data-delete-supplier]").forEach((btn) =>
    btn.addEventListener("click", () => deleteSupplier(btn.dataset.deleteSupplier))
  );

  document.querySelectorAll("[data-edit-deal]").forEach((btn) =>
    btn.addEventListener("click", () => showEditDealForm(btn.dataset.editDeal))
  );

  document.querySelectorAll("[data-delete-deal]").forEach((btn) =>
    btn.addEventListener("click", () => deleteDeal(btn.dataset.deleteDeal))
  );

  document.querySelectorAll("[data-print-pi]").forEach((btn) =>
    btn.addEventListener("click", () => printDoc("pi", btn.dataset.printPi))
  );

  document.querySelectorAll("[data-print-ci]").forEach((btn) =>
    btn.addEventListener("click", () => printDoc("ci", btn.dataset.printCi))
  );

  document.querySelectorAll("[data-print-pl]").forEach((btn) =>
    btn.addEventListener("click", () => printDoc("pl", btn.dataset.printPl))
  );

  document.querySelectorAll("[data-print-coo]").forEach((btn) =>
    btn.addEventListener("click", () => printDoc("coo", btn.dataset.printCoo))
  );
  
  document.querySelectorAll("[data-edit-product]").forEach((btn) =>
    btn.addEventListener("click", () => showEditProductForm(btn.dataset.editProduct))
  );
  
  document.querySelectorAll("[data-delete-product]").forEach((btn) =>
    btn.addEventListener("click", () => deleteProduct(btn.dataset.deleteProduct))
  );

  bindBankInputs();
  bindShipperInputs();
  bindShippingInstructionForm();
  bindProductSelectors();
}

function loginView() {
  return `
    <div class="card" style="max-width:420px;margin:40px auto">
      <div class="title" style="margin-bottom:12px">Login</div>

      <form id="login-form" class="item">
        <div style="display:grid;gap:10px">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Email</label>
            <input name="email" type="email" placeholder="Email" required>
          </div>

          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Password</label>
            <input name="password" type="password" placeholder="Password" required>
          </div>

          <button type="submit" style="background:#d4a646;color:#fff;border:none">Login</button>
        </div>
      </form>
    </div>
  `;
}
function showBuyerForm() {
  const wrap = document.getElementById("buyer-form-wrap");
  if (!wrap) return;
  wrap.innerHTML = buyerFormHtml();
  document.getElementById("buyer-form").addEventListener("submit", saveBuyer);
  document.getElementById("cancel-buyer-form").addEventListener("click", () => (wrap.innerHTML = ""));
}

function showSupplierForm() {
  const wrap = document.getElementById("supplier-form-wrap");
  if (!wrap) return;
  wrap.innerHTML = supplierFormHtml();
  document.getElementById("supplier-form").addEventListener("submit", saveSupplier);
  document.getElementById("cancel-supplier-form").addEventListener("click", () => (wrap.innerHTML = ""));
}
function bindDealProductHsn(edit = false, id = "") {
  const productEl = document.getElementById(edit ? `product-name-${id}` : "product-name");
  const hsnEl = document.getElementById(edit ? `hsn-code-${id}` : "hsn-code");

  if (!productEl || !hsnEl) return;

  function syncHsn() {
    const selectedOption = productEl.options[productEl.selectedIndex];
    const hsn = selectedOption?.getAttribute("data-hsn") || "";
    hsnEl.value = hsn;
  }

  productEl.addEventListener("change", syncHsn);
}
function showDealForm() {
  const wrap = document.getElementById("deal-form-wrap");
  if (!wrap) return;
  wrap.innerHTML = dealFormHtml({}, false);
  document.getElementById("deal-form").addEventListener("submit", saveDeal);
  document.getElementById("cancel-deal-form").addEventListener("click", () => (wrap.innerHTML = ""));
  bindDealAutoTotal(false);
  bindDealProductHsn(false);
}

function showEditBuyerForm(id) {
  const b = state.buyers.find((x) => String(x.id) === String(id));
  const wrap = document.getElementById(`buyer-edit-wrap-${id}`);
  if (!b || !wrap) return;
  wrap.innerHTML = buyerFormHtml(b, true, id);
  document.getElementById(`buyer-edit-form-${id}`).addEventListener("submit", (e) => updateBuyer(e, id));
  document.getElementById(`cancel-buyer-edit-${id}`).addEventListener("click", () => (wrap.innerHTML = ""));
}

function showEditSupplierForm(id) {
  const s = state.suppliers.find((x) => String(x.id) === String(id));
  const wrap = document.getElementById(`supplier-edit-wrap-${id}`);
  if (!s || !wrap) return;
  wrap.innerHTML = supplierFormHtml(s, true, id);
  document.getElementById(`supplier-edit-form-${id}`).addEventListener("submit", (e) => updateSupplier(e, id));
  document.getElementById(`cancel-supplier-edit-${id}`).addEventListener("click", () => (wrap.innerHTML = ""));
}

function showEditDealForm(id) {
  const deal = state.deals.find((d) => String(d.id) === String(id));
  const wrap = document.getElementById(`deal-edit-wrap-${id}`);
  if (!deal || !wrap) return;
  wrap.innerHTML = dealFormHtml(deal, true, id);
  document.getElementById(`deal-edit-form-${id}`).addEventListener("submit", (e) => updateDeal(e, id));
  document.getElementById(`cancel-deal-edit-${id}`)?.addEventListener("click", () => (wrap.innerHTML = ""));
  bindDealAutoTotal(true, id);
  bindDealProductHsn(true, id);
}

function showPaymentForm(dealId) {
  const wrap = document.getElementById(`payment-form-wrap-${dealId}`);
  const deal = state.deals.find((d) => String(d.id) === String(dealId));
  if (!wrap || !deal) return;

  const banks = state.company.bankAccounts || [];

  wrap.innerHTML = `
    <form data-payment-form="${dealId}" class="item" style="margin-top:10px">
      <div style="font-weight:800;margin-bottom:12px;color:#d4a646">New Payment</div>
      <div style="display:grid;gap:10px">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Direction</label>
            <select name="direction" required>
              <option value="in">Payment In</option>
              <option value="out">Payment Out</option>
            </select>
          </div>

          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Amount</label>
            <input name="amount" type="number" step="0.01" placeholder="Amount" required>
          </div>
        </div>

        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Payment Mode</label>
          <select name="payment_mode" id="payment-mode" required>
            <option value="">Select Mode</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank Transfer</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div id="bank-wrapper" style="display:none">
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Bank Account</label>
          <select name="method" id="bank-select">
            <option value="">Select Bank</option>
            ${banks.map((b) => `
              <option value="${esc(`${b.bankName} - ${b.account}`)}">
                ${esc(b.bankName)} (${esc(b.account)})
              </option>
            `).join("")}
          </select>
        </div>

        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Currency</label>
          <input name="currency" value="${esc(deal.currency || "AED")}">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Reference</label>
            <input name="ref" placeholder="Reference">
          </div>

          <div>
            <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Status</label>
            <select name="status">
              <option value="received">Received</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <div>
          <label style="display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#94a3b8">Payment Date</label>
          <input name="payment_date" type="date" required>
        </div>

        <div style="display:flex;gap:10px">
          <button type="submit" style="background:#d4a646;color:#fff;border:none">Save Payment</button>
          <button type="button" data-cancel-payment-form="${dealId}">Cancel</button>
        </div>
      </div>
    </form>
  `;

  const modeSelect = wrap.querySelector("#payment-mode");
  const bankWrapper = wrap.querySelector("#bank-wrapper");
  const bankSelect = wrap.querySelector("#bank-select");

  modeSelect.addEventListener("change", () => {
    if (modeSelect.value === "bank") {
      bankWrapper.style.display = "block";
    } else {
      bankWrapper.style.display = "none";
      if (bankSelect) bankSelect.value = "";
    }
  });

  wrap.querySelector(`[data-payment-form="${dealId}"]`)?.addEventListener("submit", (e) => savePayment(e, dealId));
  wrap.querySelector(`[data-cancel-payment-form="${dealId}"]`)?.addEventListener("click", () => (wrap.innerHTML = ""));
}

async function saveCompanySettings(e) {
  e.preventDefault();

  const fd = new FormData(e.target);

  const payload = {
    id: 1,
    name: cleanText(fd.get("name")),
    address: cleanText(fd.get("address")),
    mobile: state.company.mobile || "+971524396170",
    email: state.company.email || "info@jkpetrochem.com",
    bank_accounts: Array.isArray(state.company.bankAccounts)
      ? state.company.bankAccounts
      : [],
    shippers: Array.isArray(state.company.shippers)
      ? state.company.shippers
      : []
  };

  const { data, error } = await supabase
    .from("company_settings")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  state.company = {
    ...state.company,
    id: data.id,
    name: data.name || "",
    address: data.address || "",
    mobile: data.mobile || "",
    email: data.email || "",
    bankAccounts: Array.isArray(data.bank_accounts) ? data.bank_accounts : [],
    shippers: Array.isArray(data.shippers) ? data.shippers : []
  };

  alert("Saved successfully ✅");
  navigate("#/");
}

async function loadCompanySettings() {
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  if (data) {
    state.company = {
      ...state.company,
      id: data.id,
      name: data.name || state.company.name,
      address: data.address || state.company.address,
      mobile: data.mobile || state.company.mobile,
      email: data.email || state.company.email,
      bankAccounts: Array.isArray(data.bank_accounts) ? data.bank_accounts : [],
      shippers: Array.isArray(data.shippers) ? data.shippers : []
    };
  }
}

function addBankAccount() {
  if (!Array.isArray(state.company.bankAccounts)) {
    state.company.bankAccounts = [];
  }

  state.company.bankAccounts.push({
    bankName: "",
    account: "",
    iban: "",
    swift: ""
  });

  render();
}
function addShipper() {
  if (!Array.isArray(state.company.shippers)) {
    state.company.shippers = [];
  }

  state.company.shippers.push({
    name: "",
    address: "",
    mobile: "",
    email: ""
  });

  render();
}
function bindBankInputs() {
  document.querySelectorAll("[data-bank-field]").forEach((input) => {
    input.addEventListener("input", (e) => {
      const index = Number(e.target.dataset.bankIndex);
      const field = e.target.dataset.bankField;

      if (!state.company.bankAccounts[index]) return;
      state.company.bankAccounts[index][field] = e.target.value;
    });
  });
}
function bindShipperInputs() {
  document.querySelectorAll("[data-shipper-field]").forEach((input) => {
    input.addEventListener("input", (e) => {
      const index = Number(e.target.dataset.shipperIndex);
      const field = e.target.dataset.shipperField;

      if (!state.company.shippers[index]) return;
      state.company.shippers[index][field] = e.target.value;
    });
  });
}
function getBankForDeal(company = {}, deal = {}) {
  const banks = company.bankAccounts || [];
  const selected =
    deal?.document_bank_index != null
      ? banks[Number(deal.document_bank_index)]
      : null;

  const bank = selected || banks[0] || null;

  if (!bank) return company;

  return {
    ...company,
    bankName: bank.bankName || "",
    bankAccount: bank.account || "",
    bankIBAN: bank.iban || "",
    bankSWIFT: bank.swift || ""
  };
}

function getShipperForDeal(company = {}, deal = {}) {
  const shippers = company.shippers || [];
  const selected =
    deal?.shipper_index != null
      ? shippers[Number(deal.shipper_index)]
      : null;

  const shipper = selected || null;

  if (!shipper) return company;

  return {
    ...company,
    name: shipper.name || company.name || "",
    address: shipper.address || company.address || "",
    mobile: shipper.mobile || company.mobile || "",
    email: shipper.email || company.email || ""
  };
}

function printDoc(type, dealId) {
  const deal = state.deals.find((d) => String(d.id) === String(dealId));
  if (!deal) return;

  const buyer = state.buyers.find((b) => String(b.id) === String(deal.buyer_id));
  const supplierRaw = state.suppliers.find((s) => String(s.id) === String(deal.supplier_id));
  const supplier = supplierRaw
    ? {
        ...supplierRaw,
        companyName: supplierRaw.company_name,
        bankName: supplierRaw.bank_name,
        bankAccount: supplierRaw.bank_account,
        bankIBAN: supplierRaw.bank_iban,
        bankSWIFT: supplierRaw.bank_swift
      }
    : null;

  // replace here
  const currency = deal.document_currency || deal.currency || deal.base_currency || "AED";

  const dealDoc = {
    ...deal,
    currency,
    rate: currency === "USD"
      ? (deal.rate_usd ?? deal.rate)
      : (deal.rate_aed ?? deal.rate),
    totalAmount: currency === "USD"
      ? (deal.total_amount_usd ?? deal.total_amount)
      : (deal.total_amount_aed ?? deal.total_amount),
    dealNo: deal.deal_no,
    productName: deal.product_name,
    loadingPort: deal.loading_port,
    dischargePort: deal.discharge_port,
    hsn: deal.hsn_code  
  };

  const companyWithBank = getBankForDeal(state.company, deal);
  const companyForDocs = getShipperForDeal(companyWithBank, deal);

  let html = "";
  if (type === "pi") html = buildPI(dealDoc, buyer, supplier, companyForDocs);
  if (type === "ci") html = buildCI(dealDoc, buyer, supplier, companyForDocs);
  if (type === "pl") html = buildPL(dealDoc, buyer, supplier, companyForDocs);
  if (type === "coo") html = buildCOO(dealDoc, buyer, supplier, companyForDocs);

  if (!html) return;
  const ok = openPrintWindow(html);
 if (!ok) alert("Failed to open document preview.");
}

async function saveBuyer(e) {
  e.preventDefault();
  const fd = new FormData(e.target);

  const customerId = normalizeCustomerId(fd.get("customer_id"));

  if (!customerId) {
    alert("Customer ID is required");
    return;
  }

  const duplicate = state.buyers.find((b) => normalizeCustomerId(b.customer_id) === customerId);
  if (duplicate) {
    alert("Customer ID already exists");
    return;
  }

  const { error } = await supabase.from("buyers").insert({
    name: fd.get("name") || "",
    address: fd.get("address") || "",
    gst: fd.get("gst") || "",
    iec: fd.get("iec") || "",
    pan: fd.get("pan") || "",
    customer_id: customerId,
    phone: fd.get("phone") || ""
  });

  if (error) return alert(error.message);
  await loadSupabaseData();
  navigate("#/buyers");
}

async function updateBuyer(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);

  const customerId = normalizeCustomerId(fd.get("customer_id"));

  if (!customerId) {
    alert("Customer ID is required");
    return;
  }

  const duplicate = state.buyers.find(
    (b) =>
      String(b.id) !== String(id) &&
      normalizeCustomerId(b.customer_id) === customerId
  );

  if (duplicate) {
    alert("Customer ID already exists");
    return;
  }

  const { error } = await supabase
    .from("buyers")
    .update({
      name: fd.get("name") || "",
      address: fd.get("address") || "",
      gst: fd.get("gst") || "",
      iec: fd.get("iec") || "",
      pan: fd.get("pan") || "",
      customer_id: customerId,
      phone: fd.get("phone") || ""
    })
    .eq("id", id);

  if (error) return alert(error.message);
  await loadSupabaseData();
  navigate("#/buyers");
}

async function deleteBuyer(id) {
  if (!confirm("Delete this buyer?")) return;
  const { error } = await supabase.from("buyers").delete().eq("id", id);
  if (error) return alert(error.message);
  await loadSupabaseData();
  navigate("#/buyers");
}

async function saveSupplier(e) {
  e.preventDefault();
  const fd = new FormData(e.target);

  const { error } = await supabase.from("suppliers").insert({
    name: fd.get("name") || "",
    company_name: fd.get("company_name") || "",
    country: fd.get("country") || "",
    email: fd.get("email") || "",
    address: fd.get("address") || "",
    bank_name: fd.get("bank_name") || "",
    bank_account: fd.get("bank_account") || "",
    bank_iban: fd.get("bank_iban") || "",
    bank_swift: fd.get("bank_swift") || ""
  });

  if (error) return alert(error.message);
  await loadSupabaseData();
  navigate("#/suppliers");
}

async function updateSupplier(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);

  const { error } = await supabase
    .from("suppliers")
    .update({
      name: fd.get("name") || "",
      company_name: fd.get("company_name") || "",
      country: fd.get("country") || "",
      email: fd.get("email") || "",
      address: fd.get("address") || "",
      bank_name: fd.get("bank_name") || "",
      bank_account: fd.get("bank_account") || "",
      bank_iban: fd.get("bank_iban") || "",
      bank_swift: fd.get("bank_swift") || ""
    })
    .eq("id", id);

  if (error) return alert(error.message);
  await loadSupabaseData();
  navigate("#/suppliers");
}

async function deleteSupplier(id) {
  if (!confirm("Delete this supplier?")) return;
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return alert(error.message);
  await loadSupabaseData();
  navigate("#/suppliers");
}

function validateDeal(fd) {
  const type = cleanText(fd.get("type") || "sell");
  const deal_no = cleanText(fd.get("deal_no"));
  const product_name = cleanText(fd.get("product_name"));
  const hsn_code = cleanText(fd.get("hsn_code"));
  const unit = cleanText(fd.get("unit") || "MTON");

  const base_currency = cleanText(fd.get("base_currency") || "USD");
  const document_currency = cleanText(fd.get("document_currency") || base_currency);
  const conversion_rate = cleanNumber(fd.get("conversion_rate"));

  const quantity = cleanNumber(fd.get("quantity"));
  const rate = cleanNumber(fd.get("rate"));

  const document_bank_index_raw = cleanText(fd.get("document_bank_index"));
  const document_bank_index =
    document_bank_index_raw === "" ? null : Number(document_bank_index_raw);
  const shipper_index_raw = cleanText(fd.get("shipper_index"));
  const shipper_index = shipper_index_raw === "" ? null : Number(shipper_index_raw);
  let total_amount_usd = 0;
  let total_amount_aed = 0;
  let rate_usd = 0;
  let rate_aed = 0;

  if (base_currency === "USD") {
    rate_usd = rate;
    rate_aed = conversion_rate ? rate * conversion_rate : 0;
    total_amount_usd = quantity * rate_usd;
    total_amount_aed = conversion_rate ? total_amount_usd * conversion_rate : 0;
  } else {
    rate_aed = rate;
    rate_usd = conversion_rate ? rate / conversion_rate : 0;
    total_amount_aed = quantity * rate_aed;
    total_amount_usd = conversion_rate ? total_amount_aed / conversion_rate : 0;
  }

  const total_amount = document_currency === "USD" ? total_amount_usd : total_amount_aed;
  const currency = document_currency;
  const status = cleanText(fd.get("status") || "active");
  const approval_status = cleanText(fd.get("approval_status") || "draft");
  const loading_port = cleanUpper(fd.get("loading_port"));
  const discharge_port = cleanUpper(fd.get("discharge_port"));
  const buyer_id = cleanText(fd.get("buyer_id"));
  const supplier_id = cleanText(fd.get("supplier_id"));

  if (!deal_no) throw new Error("Deal no is required");
  if (!product_name) throw new Error("Product name is required");
  if (quantity <= 0) throw new Error("Quantity must be greater than 0");
  if (rate <= 0) throw new Error("Rate must be greater than 0");
  if (!loading_port) throw new Error("Loading port is required");
  if (!discharge_port) throw new Error("Discharge port is required");
  if (type === "sell" && !buyer_id) throw new Error("Buyer is required for sell deals");
  if (type === "purchase" && !supplier_id) throw new Error("Supplier is required for purchase deals");

  return {
    type,
    deal_no,
    product_name,
    hsn_code,
    unit,
    base_currency,
    document_currency,
    conversion_rate,
    document_bank_index,
    shipper_index,
    currency,
    quantity,
    rate,
    rate_usd,
    rate_aed,
    total_amount,
    total_amount_usd,
    total_amount_aed,
    status,
    approval_status,
    loading_port,
    discharge_port,
    buyer_id: buyer_id || null,
    supplier_id: supplier_id || null,
    vessel: cleanUpper(fd.get("vessel")),
    vessel_voyage: cleanUpper(fd.get("vessel_voyage")),
    shipment_out_date: cleanText(fd.get("shipment_out_date")) || null,
    eta: cleanText(fd.get("eta")) || null,
    freight_type: cleanText(fd.get("freight_type") || "BY SEA"),
    shipment_status: cleanText(fd.get("shipment_status") || "pending"),
    gross_weight: cleanNumber(fd.get("gross_weight")) || null,
    net_weight: cleanNumber(fd.get("net_weight")) || null,
    package_details: cleanText(fd.get("package_details")),
    loaded_on: cleanText(fd.get("loaded_on")),
    container_numbers: [...new Set(
  String(fd.get("container_numbers") || "")
    .split(/[\n,]+/)
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean)
)].join("\n"),
    bl_no: cleanUpper(fd.get("bl_no")),
    cfs: cleanText(fd.get("cfs")),
    country_of_origin: cleanUpper(fd.get("country_of_origin")),
    terms_delivery: cleanUpper(fd.get("terms_delivery")),
    payment_terms: cleanText(fd.get("payment_terms")),
    bank_terms: cleanText(fd.get("bank_terms")),
    pi_no: cleanText(fd.get("pi_no")),
    ci_no: cleanText(fd.get("ci_no")),
    pl_no: cleanText(fd.get("pl_no")),
    coo_no: cleanText(fd.get("coo_no")),
    invoice_date: cleanText(fd.get("invoice_date")) || null
  };
}

async function saveDeal(e) {
  e.preventDefault();
  const fd = new FormData(e.target);

  try {
    let payload = validateDeal(fd);
    payload = ensureDocNumbers(payload);

    const { error } = await supabase.from("deals").insert(payload);
    if (error) throw error;

    await loadSupabaseData();
    navigate("#/deals");
  } catch (err) {
    alert(err.message || "Failed to save deal");
  }
}

async function updateDeal(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);

  try {
    const existing = state.deals.find((d) => String(d.id) === String(id));

    if (existing?.approval_status === "locked") {
      alert("Locked deals cannot be edited");
      return;
    }

    let payload = validateDeal(fd);
    payload = ensureDocNumbers(payload, existing);

    const { error } = await supabase
      .from("deals")
      .update(payload)
      .eq("id", id);

    if (error) throw error;

    await loadSupabaseData();
    navigate("#/deals");
  } catch (err) {
    alert(err.message || "Failed to update deal");
  }
}

async function deleteDeal(id) {
  if (!confirm("Delete this deal?")) return;
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) return alert(error.message);
  await loadSupabaseData();
  navigate("#/deals");
}

async function savePayment(e, dealId) {
  e.preventDefault();

  const fd = new FormData(e.target);
  const direction = fd.get("direction");
  const amount = Number(fd.get("amount"));
  const currency = fd.get("currency") || "AED";
  const ref = fd.get("ref") || "";
  const status = fd.get("status") || "received";
  const payment_date = fd.get("payment_date");
  const payment_mode = fd.get("payment_mode");

  let method = "";
  if (payment_mode === "bank") {
    method = fd.get("method");
    if (!method) return alert("Please select a bank");
  } else {
    method = payment_mode;
  }

  if (!amount || amount <= 0) return alert("Amount must be greater than 0");
  if (!payment_mode) return alert("Please select payment mode");
  if (!payment_date) return alert("Please select payment date");

  const { error } = await supabase.from("payments").insert({
    deal_id: dealId,
    direction,
    amount,
    currency,
    method,
    payment_mode,
    ref,
    status,
    payment_date
  });

  if (error) return alert(error.message);

  alert("Payment saved successfully ✅");
  await loadSupabaseData();
  if (state.page === "dealDetail") render();
  else navigate("#/deals");
}

async function deletePayment(dealId, paymentId) {
  if (!confirm("Delete this payment?")) return;
  const { error } = await supabase.from("payments").delete().eq("id", paymentId).eq("deal_id", dealId);
  if (error) return alert(error.message);
  await loadSupabaseData();
  if (state.page === "dealDetail") render();
  else navigate("#/deals");
}

async function savePlaceholderDocument(e, dealId) {
  e.preventDefault();

  try {
    const fd = new FormData(e.target);
    const docType = cleanText(fd.get("docType"));
    const file = fd.get("file");

    if (!file || !file.name) {
      alert("Please select a file");
      return;
    }

    await uploadDealDocument(file, dealId, docType || "Other");

    alert("Document uploaded successfully ✅");
    await loadSupabaseData();

    if (state.page === "dealDetail") render();
    else navigate("#/deals");

    e.target.reset();
  } catch (err) {
    alert(err.message || "Failed to upload document");
  }
}

async function deletePlaceholderDocument(dealId, index) {
  const list = state.documentsByDeal[String(dealId)] || [];
  const doc = list[index];
  if (!doc) return;

  if (!confirm("Delete this document?")) return;

  try {
    await deleteDealDocument(doc);
    await loadSupabaseData();
    if (state.page === "dealDetail") render();
    else navigate("#/deals");
  } catch (err) {
    alert(err.message || "Failed to delete document");
  }
}
async function uploadDealDocument(file, dealId, docType = "Other") {
  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `${dealId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("deal-documents")
    .upload(filePath, file, {
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from("deal-documents")
    .getPublicUrl(filePath);

  const fileUrl = publicUrlData?.publicUrl || null;

  const { error: dbError } = await supabase
    .from("deal_documents")
    .insert({
      deal_id: dealId,
      doc_type: docType,
      file_name: file.name,
      file_path: filePath,
      file_url: fileUrl,
      mime_type: file.type || null,
      file_size: file.size || null
    });

  if (dbError) throw dbError;

  return { filePath, fileUrl };
}
async function deleteDealDocument(doc) {
  if (doc.file_path) {
    const { error: storageError } = await supabase.storage
      .from("deal-documents")
      .remove([doc.file_path]);

    if (storageError) throw storageError;
  }

  const { error: dbError } = await supabase
    .from("deal_documents")
    .delete()
    .eq("id", doc.id);

  if (dbError) throw dbError;
}
async function loadSupabaseData() {
  try {
    const [buyersRes, suppliersRes, dealsRes, paymentsRes, documentsRes, auditRes] = await Promise.all([
      supabase.from("buyers").select("*").order("id", { ascending: false }),
      supabase.from("suppliers").select("*").order("id", { ascending: false }),
      supabase.from("deals").select("*").order("id", { ascending: false }),
      supabase.from("payments").select("*").order("id", { ascending: false }),
      supabase.from("deal_documents").select("*").eq("is_deleted", false).order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false })
    ]);

    if (buyersRes.error) throw buyersRes.error;
    if (suppliersRes.error) throw suppliersRes.error;
    if (dealsRes.error) throw dealsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;
    if (documentsRes.error) throw documentsRes.error;
    if (auditRes.error) throw auditRes.error;

    state.buyers = buyersRes.data || [];
    state.suppliers = suppliersRes.data || [];
    state.deals = dealsRes.data || [];

    const groupedPayments = {};
    (paymentsRes.data || []).forEach((p) => {
      const key = String(p.deal_id);
      if (!groupedPayments[key]) groupedPayments[key] = [];
      groupedPayments[key].push(p);
    });
    state.paymentsByDeal = groupedPayments;

    const groupedDocuments = {};
    (documentsRes.data || []).forEach((doc) => {
      const key = String(doc.deal_id);
      if (!groupedDocuments[key]) groupedDocuments[key] = [];
      groupedDocuments[key].push(doc);
    });
    state.documentsByDeal = groupedDocuments;

    const groupedAudit = {};
    (auditRes.data || []).forEach((log) => {
      const key = `${log.entity_type}:${log.entity_id}`;
      if (!groupedAudit[key]) groupedAudit[key] = [];
      groupedAudit[key].push(log);
    });
    state.auditLogsByEntity = groupedAudit;

    await loadCompanySettings();

    try { await loadProducts(); } catch (e) { console.error("loadProducts failed", e); state.products = []; }
    try { await loadShippingInstructions(); } catch (e) { console.error("loadShippingInstructions failed", e); state.shippingInstructions = []; }

    state.error = "";
    state.ready = true;
  } catch (err) {
    console.error(err);
    state.error = err.message || "Failed to load Supabase data";
    state.ready = false;
  }

  handleRoute();
}

function exportDealsCsv() {
  const q = state.dealSearch.trim().toLowerCase();

  const filteredDeals = state.deals.filter((d) => {
    if (!q) return true;
    const buyer = buyerName(d.buyer_id).toLowerCase();
    const supplier = supplierName(d.supplier_id).toLowerCase();
    const text = [
      d.deal_no,
      d.product_name,
      d.hsn_code,
      d.loading_port,
      d.discharge_port,
      d.status,
      d.type,
      buyer,
      supplier
    ].join(" ").toLowerCase();
    return text.includes(q);
  });

  const rows = [[
    "Deal No", "Type", "Product", "HSN Code", "Buyer", "Supplier", "Loading Port", "Discharge Port", "Currency", "Total Amount", "Status"
  ]];

  filteredDeals.forEach((d) => {
    rows.push([
      d.deal_no || "",
      d.type || "",
      d.product_name || "",
      d.hsn_code || "",
      buyerName(d.buyer_id),
      supplierName(d.supplier_id),
      d.loading_port || "",
      d.discharge_port || "",
      d.currency || "AED",
      d.total_amount || 0,
      d.status || ""
    ]);
  });

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = q ? "deals-filtered-export.csv" : "deals-export.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

loadSession();