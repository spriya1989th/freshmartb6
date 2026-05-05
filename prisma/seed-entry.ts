// Railway-compatible seed entry point
// Reads RUN_SEED env var so you can trigger seeding via Railway dashboard

if (process.env.NODE_ENV === 'production' && process.env.RUN_SEED !== 'true') {
  console.log('Skipping seed in production (set RUN_SEED=true to seed)');
  process.exit(0);
}

// Run the actual seed
require('./seed');
