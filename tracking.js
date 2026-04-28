import { state } from "./state.js";
import { esc } from "./utils.js";

export function trackingView() {
  const deals = state.deals || [];
  
  // Only show deals that have some tracking info
  const trackableDeals = deals.filter(d => 
    d.bl_no || 
    (Array.isArray(d.container_numbers) && d.container_numbers.length > 0) || 
    d.vessel_name
  );

  return `
    <div class="card">
      <div class="flex flex-between flex-center gap-12 mb-12 flex-wrap">
        <div class="title mb-0">Shipment Tracking</div>
      </div>

      <div class="item mb-20" style="background:rgba(212, 175, 55, 0.05); border:1px solid rgba(212, 175, 55, 0.2)">
        <div class="item-title mb-8" style="color:var(--accent-primary)">Quick Tracking Search</div>
        <div class="grid grid-3 gap-10">
          <div style="grid-column: span 1">
            <label class="form-label">Shipping Line</label>
            <select id="track-line">
              <option value="google">Search Google</option>
              <option value="maersk">Maersk</option>
              <option value="msc">MSC</option>
              <option value="cma">CMA CGM</option>
              <option value="hapag">Hapag-Lloyd</option>
              <option value="cosco">COSCO</option>
              <option value="one">ONE (Ocean Network Express)</option>
              <option value="evergreen">Evergreen</option>
              <option value="yangming">Yang Ming</option>
              <option value="zim">ZIM</option>
              <option value="wanhai">Wan Hai</option>
              <option value="marinetraffic">MarineTraffic (Vessel)</option>
              <option value="vesselfinder">VesselFinder (Vessel)</option>
            </select>
          </div>
          <div style="grid-column: span 2">
            <label class="form-label">Container / BL / Vessel No</label>
            <div class="flex gap-8">
              <input id="track-number" placeholder="Enter tracking number or vessel name..." style="background:rgba(0,0,0,0.4)">
              <button id="btn-quick-track" class="btn-primary" style="white-space:nowrap">Open Official Site</button>
            </div>
          </div>
        </div>
        <div class="item-sub mt-8 opacity-60">
           Select a line and enter the number to open their official tracking page in a new tab.
        </div>
      </div>

      <div class="title mb-10" style="font-size:16px">Trackable Shipments (Active Deals)</div>
      <div class="list">
        ${trackableDeals.length ? trackableDeals.map(d => {
          let containerList = [];
          try {
            let raw = d.container_numbers;
            if (Array.isArray(raw)) {
              containerList = raw;
            } else if (typeof raw === "string") {
              // Try to find all alphanumeric strings that look like container numbers
              // Usually 4 letters + 7 digits, but let's be flexible
              containerList = raw.match(/[A-Z0-9]{5,15}/gi) || [];
            }
            
            // Final aggressive clean
            containerList = containerList.map(c => c.replace(/[^A-Z0-9]/gi, "").trim())
                                        .filter(c => c.length >= 4); // Containers are usually 11 chars, but let's allow 4+
            
            // Remove duplicates
            containerList = [...new Set(containerList)];
          } catch(e) { containerList = []; }
          
          const containerStr = containerList.join(", ");

          return `
            <div class="item" style="overflow: hidden; max-width: 100%;">
              <div class="flex flex-between flex-top flex-wrap gap-12">
                <div style="flex: 1; min-width: 0; width: 100%;">
                  <div class="item-title" style="font-size:15px">${esc(d.deal_no)} · ${esc(d.product_name)}</div>
                  <div class="item-sub" style="margin-top:6px">
                    ${d.bl_no ? `<span class="badge" style="background:rgba(59,130,246,0.2); color:#60a5fa">BL: ${esc(d.bl_no)}</span>` : ""}
                    ${d.vessel_name ? `<span class="badge" style="background:rgba(16,185,129,0.2); color:#34d399; margin-left:5px">Vessel: ${esc(d.vessel_name)}</span>` : ""}
                  </div>
                  ${containerStr ? `<div class="item-sub mt-8" style="font-size:11px; opacity:0.8; overflow-wrap: anywhere; word-break: break-all; white-space: normal; line-height: 1.6; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px;"><strong>Containers:</strong> ${esc(containerStr)}</div>` : ""}
                </div>
                <div class="flex gap-8 flex-wrap" style="align-items:flex-start">
                   <button class="btn-xs btn-info" data-track-deal-bl="${d.id}">Track</button>
                   <button class="btn-xs btn-outline" data-update-tracking="${d.id}">Log Status</button>
                </div>
              </div>

              <div id="tracking-status-display-${d.id}" class="mt-12 p-12" style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:6px; display:${d.tracking_status ? 'block' : 'none'}">
                 <div style="font-size:11px; font-weight:800; color:var(--accent-primary); text-transform:uppercase; margin-bottom:5px">Tracking Status Logs</div>
                 <div class="item-sub" style="white-space:pre-wrap; color:var(--text)">${esc(d.tracking_status || "")}</div>
                 <div style="font-size:10px; opacity:0.4; margin-top:8px; text-align:right">Updated: ${d.tracking_updated_at ? new Date(d.tracking_updated_at).toLocaleString() : "Never"}</div>
              </div>

              <div id="update-tracking-wrap-${d.id}" class="mt-12" style="display:none; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px solid var(--border)">
                 <div class="item-sub mb-8" style="font-weight:700">Update Tracking Notes / Status:</div>
                 <textarea id="tracking-input-${d.id}" placeholder="e.g. 2024-05-10: Vessel at port. Discharge expected tomorrow..." style="min-height:100px; font-size:12px">${esc(d.tracking_status || "")}</textarea>
                 <div class="mt-10 flex gap-8">
                    <button class="btn-xs btn-primary" data-save-tracking="${d.id}">Save Log</button>
                    <button class="btn-xs" onclick="document.getElementById('update-tracking-wrap-${d.id}').style.display='none'">Cancel</button>
                 </div>
              </div>
            </div>
          `;
        }).join("") : `<div class="empty">No shipments found with BL or Container info. Update your deals first!</div>`}
      </div>
    </div>
  `;
}

export function performQuickTrack() {
  const line = document.getElementById("track-line")?.value;
  const num = document.getElementById("track-number")?.value?.trim();
  
  if (!num) return alert("Please enter a number or vessel name.");
  
  let url = "";
  switch(line) {
    case "maersk": url = `https://www.maersk.com/tracking?containerNumber=${num}`; break;
    case "msc": url = `https://www.msc.com/en/track-a-shipment?query=${num}`; break;
    case "cma": url = `https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=Container&SearchValue=${num}`; break;
    case "hapag": url = `https://www.hapag-lloyd.com/en/online-business/track-trace/track-trace-by-container-number.html?container=${num}`; break;
    case "cosco": url = `https://elines.coscoshipping.com/ebusiness/cargoTracking?number=${num}`; break;
    case "one": url = `https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?containerNumber=${num}`; break;
    case "evergreen": url = `https://ct.shipmenttracking.com/tnt/shipment_tracking_tracking_results.jsp?line_name=EISU&container_no=${num}`; break;
    case "yangming": url = `https://www.yangming.com/e-service/track_trace/track_trace_cargo_tracking.aspx?type=container&number=${num}`; break;
    case "zim": url = `https://www.zim.com/tools/track-a-shipment?containerNumber=${num}`; break;
    case "wanhai": url = `https://www.wanhai.com/views/cargoTrack/cargoTrack.xhtml?q=${num}`; break;
    case "marinetraffic": url = `https://www.marinetraffic.com/en/ais/details/ships/vessel:${num}`; break;
    case "vesselfinder": url = `https://www.vesselfinder.com/vessels?name=${num}`; break;
    case "google": url = `https://www.google.com/search?q=track+shipment+${num}`; break;
    default: url = `https://www.google.com/search?q=track+shipment+${num}`;
  }
  
  window.open(url, "_blank");
}
