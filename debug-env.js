// Debug script to check environment variables
require('dotenv').config();

console.log('=== Environment Debug ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('QUOTES_FILE:', process.env.QUOTES_FILE);
console.log('Working Directory:', process.cwd());
console.log('__dirname:', __dirname);

// Check if the expected files exist
const fs = require('fs');
const path = require('path');

const paths = [
  'quotes.yaml',
  'data/quotes.yaml',
  '/app/data/quotes.yaml',
  './data/quotes.yaml'
];

console.log('\n=== File Check ===');
for (const filePath of paths) {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`✓ ${filePath} - EXISTS`);
    } else {
      console.log(`✗ ${filePath} - NOT FOUND`);
    }
  } catch (error) {
    console.log(`✗ ${filePath} - ERROR: ${error.message}`);
  }
}

// List the current directory contents
console.log('\n=== Current Directory Contents ===');
try {
  const files = fs.readdirSync(process.cwd());
  console.log(files);
} catch (error) {
  console.log('Error listing directory:', error.message);
}

// Check data directory if it exists
console.log('\n=== Data Directory Contents ===');
try {
  const dataPath = path.join(process.cwd(), 'data');
  if (fs.existsSync(dataPath)) {
    const files = fs.readdirSync(dataPath);
    console.log(files);
  } else {
    console.log('data directory does not exist');
  }
} catch (error) {
  console.log('Error listing data directory:', error.message);
}
