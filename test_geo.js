import { GeoapifyClient } from './packages/scraper-business/src/geoapifyClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const client = new GeoapifyClient();
  const places = await client.searchPlaces({
    country: 'US',
    city: 'Austin, TX',
    category: 'Commercial & Local Services',
    limit: 5
  });
  console.log("Found places:", JSON.stringify(places, null, 2));
}

run().catch(console.error);
