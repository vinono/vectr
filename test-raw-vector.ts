import { Index } from "@upstash/vector";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load env
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
    console.log("Loaded .env.local");
  }
} catch (err) {}

const url = process.env.UPSTASH_SEARCH_REST_URL;
const token = process.env.UPSTASH_SEARCH_REST_TOKEN;

async function testRawVector() {
  if (!url || !token) {
    console.error("Missing credentials!");
    return;
  }
  console.log("Initializing direct @upstash/vector Index...");
  const index = new Index({ url, token });

  const testId = `test-raw-temp-${Date.now()}`;
  try {
    console.log("Upserting test document with direct 'data' parameter...");
    await index.upsert({
      id: testId,
      data: "A test description of a beautiful sunset over mountains",
      metadata: {
        description: "A test description of a beautiful sunset over mountains",
        exif: { camera: "Test" }
      }
    });
    console.log("✅ SUCCESS! Upsert succeeded without any null errors!");

    console.log("Querying index semantically...");
    const results = await index.query({
      data: "sunset",
      topK: 1,
      includeMetadata: true,
    });
    console.log("✅ Query succeeded! Results:", JSON.stringify(results, null, 2));

    console.log("Deleting test document...");
    await index.delete([testId]);
    console.log("✅ Cleanup successful!");
  } catch (err: any) {
    console.error("❌ Failed:", err.message);
  }
}

testRawVector();
