import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { Index } from "@upstash/vector";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// 1. Load .env.local
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
    console.log("✅ Successfully loaded .env.local");
  } else {
    console.log("❌ .env.local not found!");
    process.exit(1);
  }
} catch (err) {
  console.error("Error loading env:", err);
  process.exit(1);
}

// 2. Set Up Credentials
if (process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
}

const geminiKey = process.env.GEMINI_API_KEY;
const upstashUrl = process.env.UPSTASH_SEARCH_REST_URL;
const upstashToken = process.env.UPSTASH_SEARCH_REST_TOKEN;

async function runIntegrationTest() {
  console.log("\n=== STARTING FULL INTEGRATION DIAGNOSTICS ===\n");

  // Step A: Test Gemini API
  console.log("Step A: Testing Google Gemini API...");
  if (!geminiKey) {
    console.error("❌ Error: GEMINI_API_KEY is missing in .env.local!\n");
    return false;
  }
  try {
    const model = google("gemini-2.5-flash");
    const { text } = await generateText({
      model: model as any,
      prompt: "Describe a beautiful sunset over the mountains in one sentence.",
    });
    console.log(`✅ Gemini Success! Description generated: "${text.trim()}"\n`);
  } catch (err: any) {
    console.error(`❌ Gemini Failed! Error: ${err.message}\n`);
    return false;
  }

  // Step B: Test Upstash Search Index
  console.log("Step B: Testing Upstash Search Index via @upstash/vector...");
  if (!upstashUrl || !upstashToken) {
    console.error("❌ Error: UPSTASH_SEARCH_REST_URL or UPSTASH_SEARCH_REST_TOKEN is missing in .env.local!\n");
    return false;
  }
  
  try {
    const index = new Index({ url: upstashUrl, token: upstashToken });
    
    console.log("Attempting to write a test document with text content to 'images' index...");
    const testId = `test-integration-temp-${Date.now()}`;
    
    // Attempt upsert (equivalent to indexImage.ts)
    const upsertResult = await index.upsert({
      id: testId,
      data: "A test description of a beautiful sunset",
      metadata: {
        url: "https://example.com/test.jpg",
        pathname: "test.jpg",
        description: "A test description of a beautiful sunset",
        exif: { camera: "Test Camera", focalLength: "50mm" }
      }
    });
    
    console.log("✅ Upstash Index Success! Document successfully written and auto-embedded.");
    
    // Clean up: delete the test document
    console.log("Cleaning up test document from Upstash...");
    await index.delete([testId]);
    console.log("✅ Cleanup successful!\n");
    return true;
  } catch (err: any) {
    console.error(`\n❌ Upstash Index Failed!`);
    console.error(`Error details: ${err.message}`);
    console.log("\n");
    return false;
  }
}

runIntegrationTest().then((success) => {
  if (success) {
    console.log("🎉🎉🎉 ALL TESTS PASSED! YOUR INTEGRATION IS 100% SUCCESSFUL!");
    console.log("You can now upload images and search natively in full production quality.");
  } else {
    console.log("😢 Integration test failed. Please follow the diagnostic suggestions above and try again.");
  }
});
