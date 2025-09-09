import { createClient } from '@supabase/supabase-js';

// Configure with your Supabase credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

// Realistic data pools
const companies = [
  "Google", "Microsoft", "Amazon", "Apple", "Meta", "Netflix", "Tesla", "SpaceX",
  "IBM", "Oracle", "Salesforce", "Adobe", "Intel", "AMD", "NVIDIA", "Qualcomm",
  "Twitter", "LinkedIn", "Uber", "Airbnb", "Stripe", "Square", "PayPal", "Shopify",
  "Spotify", "Slack", "Zoom", "DocuSign", "Okta", "Twilio", "DataDog", "MongoDB",
  "Elastic", "Confluent", "HashiCorp", "GitLab", "GitHub", "Atlassian", "Asana",
  "Notion", "Figma", "Canva", "Discord", "Reddit", "Pinterest", "Snapchat", "TikTok"
];

const positions = [
  "Software Engineer", "Senior Software Engineer", "Staff Software Engineer",
  "Frontend Developer", "Backend Developer", "Full Stack Developer",
  "Data Scientist", "Machine Learning Engineer", "DevOps Engineer",
  "Site Reliability Engineer", "Cloud Architect", "Solutions Architect",
  "Product Manager", "Technical Product Manager", "Engineering Manager",
  "UX Designer", "UI Designer", "Product Designer", "Data Analyst",
  "Business Analyst", "Security Engineer", "QA Engineer", "Mobile Developer"
];

const locations = [
  "San Francisco, CA", "New York, NY", "Seattle, WA", "Austin, TX",
  "Boston, MA", "Los Angeles, CA", "Chicago, IL", "Denver, CO",
  "Portland, OR", "San Diego, CA", "Atlanta, GA", "Remote",
  "Miami, FL", "Dallas, TX", "Washington, DC", "Phoenix, AZ",
  "Philadelphia, PA", "San Jose, CA", "Mountain View, CA", "Palo Alto, CA"
];

const jobSites = [
  "LinkedIn", "Indeed", "Glassdoor", "AngelList", "Dice",
  "Monster", "ZipRecruiter", "CareerBuilder", "SimplyHired",
  "Company Website", "Referral", "Recruiter", "Job Fair"
];

const statuses = ["Applied", "Assessment", "Interviewing", "Rejected", "Screening"];

// Generate random date within range
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
    .toISOString()
    .split('T')[0];
}

// Generate a single job entry
function generateJob(index) {
  const company = companies[Math.floor(Math.random() * companies.length)];
  const position = positions[Math.floor(Math.random() * positions.length)];
  const location = locations[Math.floor(Math.random() * locations.length)];
  const jobSite = jobSites[Math.floor(Math.random() * jobSites.length)];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  const appliedDate = randomDate(
    new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
    new Date()
  );
  
  // 30% chance of rejection
  const isRejected = status === "Rejected" || Math.random() < 0.3;
  const rejectionDate = isRejected 
    ? randomDate(new Date(appliedDate), new Date())
    : null;
  
  return {
    company,
    position,
    location,
    status: isRejected ? "Rejected" : status,
    appliedDate,
    rejectionDate,
    jobSite,
    url: `https://${company.toLowerCase().replace(/\s+/g, '')}.com/careers/${index}`,
    created_at: new Date().toISOString()
  };
}

// Insert jobs in batches
async function insertBatch(jobs) {
  const { data, error } = await supabase
    .from('jobs')
    .insert(jobs);
  
  if (error) {
    console.error('Error inserting batch:', error);
    return false;
  }
  
  return true;
}

// Main function to generate and insert test data
async function generateTestData(count = 10000) {
  console.log(`🚀 Starting generation of ${count} job entries...`);
  
  const batchSize = 100;
  const totalBatches = Math.ceil(count / batchSize);
  let successCount = 0;
  
  console.time('Total Generation Time');
  
  for (let batch = 0; batch < totalBatches; batch++) {
    const startIdx = batch * batchSize;
    const endIdx = Math.min(startIdx + batchSize, count);
    const jobs = [];
    
    for (let i = startIdx; i < endIdx; i++) {
      jobs.push(generateJob(i));
    }
    
    const success = await insertBatch(jobs);
    if (success) {
      successCount += jobs.length;
      const progress = ((batch + 1) / totalBatches * 100).toFixed(1);
      console.log(`✓ Batch ${batch + 1}/${totalBatches} completed (${progress}%)`);
    } else {
      console.log(`✗ Batch ${batch + 1}/${totalBatches} failed`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.timeEnd('Total Generation Time');
  
  console.log(`\n📊 Generation Complete!`);
  console.log(`✅ Successfully inserted: ${successCount} jobs`);
  console.log(`❌ Failed: ${count - successCount} jobs`);
  
  // Verify count in database
  const { count: dbCount, error } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true });
  
  if (!error) {
    console.log(`📈 Total jobs in database: ${dbCount}`);
  }
}

// Clear existing data (optional)
async function clearExistingData() {
  console.log('🗑️ Clearing existing data...');
  const { error } = await supabase
    .from('jobs')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (error) {
    console.error('Error clearing data:', error);
    return false;
  }
  
  console.log('✅ Existing data cleared');
  return true;
}

// Parse command line arguments
const args = process.argv.slice(2);
const count = parseInt(args[0]) || 10000;
const clearFirst = args.includes('--clear');

// Run the generator
async function run() {
  if (clearFirst) {
    const cleared = await clearExistingData();
    if (!cleared) {
      console.error('Failed to clear existing data. Aborting.');
      process.exit(1);
    }
  }
  
  await generateTestData(count);
  process.exit(0);
}

// Execute
run().catch(console.error);