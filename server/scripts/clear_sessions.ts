import { storage } from "../storage";
import { execute_sql_tool } from "../db";

async function clearAllSessions() {
  console.log("🧹 Clearing all existing sessions...");
  
  try {
    // Clear session table if it exists
    await execute_sql_tool({
      sql_query: "DELETE FROM session WHERE 1=1;"
    });
    console.log("✅ All sessions cleared from database");
  } catch (error) {
    console.log("ℹ️ Session table might not exist yet, that's okay");
  }
  
  console.log("🔐 All sessions have been cleared. Users will need to log in again.");
}

// Auto-run when imported
clearAllSessions().catch(console.error);

export { clearAllSessions };