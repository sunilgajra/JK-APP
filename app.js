import { getSession } from "./auth.js";
import { loadSupabaseData } from "./data.js";
import { initRouter } from "./router.js";
import { render } from "./ui.js";

async function initApp() {
  console.log("Initializing JK Trade Manager...");
  
  // 1. Get Session
  await getSession();
  
  // 2. Load Data if authenticated
  await loadSupabaseData();
  
  // 3. Init Router
  initRouter();
  
  // 4. Initial Render
  render();
  
  console.log("App initialized.");
}

// Start the app
initApp();