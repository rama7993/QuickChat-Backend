const dotenv = require('dotenv');
const path = require('path');

// Load .env from server directory
const envPath = path.join(__dirname, 'server', '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
} else {
  console.log('Environment variables loaded successfully.');
  console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
  
  const apiKey = process.env.CLOUDINARY_API_KEY;
  if (apiKey) {
    console.log('CLOUDINARY_API_KEY (masked):', apiKey.substring(0, 4) + '****' + apiKey.substring(apiKey.length - 4));
  } else {
    console.log('CLOUDINARY_API_KEY: Not set');
  }
  
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (apiSecret) {
    console.log('CLOUDINARY_API_SECRET: [Set]');
  } else {
    console.log('CLOUDINARY_API_SECRET: Not set');
  }

    console.log('CLOUDINARY_URL:', process.env.CLOUDINARY_URL ? 'Set' : 'Not set');
}
