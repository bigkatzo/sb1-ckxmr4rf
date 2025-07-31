/**
 * UPLOAD CUSTOMIZATION IMAGE
 * 
 * Server-side function for uploading customization images from base64 data
 * Uses service role credentials to access storage
 */
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Environment variables
const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
};

// Storage bucket for customization images
const CUSTOMIZATION_BUCKET = 'customization-images';

// Allowed MIME types for customization images
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'image/gif'
];

// Initialize Supabase with service role credentials
let supabase;
try {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in environment variables');
  } else {
    supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    console.log('Supabase client initialized with service role permissions');
  }
} catch (err) {
  console.error('Failed to initialize Supabase client:', err.message);
}

function errorResponse(statusCode, message, details = null) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify({
      success: false,
      error: message,
      details
    })
  };
}

function successResponse(data) {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify({
      success: true,
      ...data
    })
  };
}

/**
 * Generate a safe filename for customization images
 */
function generateCustomizationFilename(originalName, orderId, productId) {
  const timestamp = Date.now();
  const randomId = uuidv4().substring(0, 8);
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  
  // Sanitize the filename
  const sanitizedName = originalName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 50);
  
  return `customization_${orderId}_${productId}_${timestamp}_${randomId}.${extension}`;
}

exports.handler = async (event, context) => {
  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { imageBase64, originalName, orderId, productId, walletAddress } = requestBody;

    console.log('Customization image upload request received:', {
      hasImageBase64: !!imageBase64,
      originalName,
      orderId,
      productId,
      walletAddress: walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : 'anonymous'
    });

    // Validate required fields
    if (!imageBase64 || !originalName || !orderId || !productId) {
      return errorResponse(400, 'Missing required fields', {
        hasImageBase64: !!imageBase64,
        hasOriginalName: !!originalName,
        hasOrderId: !!orderId,
        hasProductId: !!productId
      });
    }

    // Extract content type from base64 data
    const base64Match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      return errorResponse(400, 'Invalid base64 format');
    }

    const contentType = base64Match[1];
    const base64Data = base64Match[2];

    console.log(`Processing upload: ${originalName} (${contentType}), base64 data length: ${base64Data.length}`);

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      return errorResponse(415, 'Upload failed', {
        error: 'invalid_mime_type',
        message: `MIME type ${contentType} is not supported`,
        statusCode: '415'
      });
    }

    // Convert base64 to buffer
    const fileData = Buffer.from(base64Data, 'base64');
    
    if (fileData.length === 0) {
      return errorResponse(400, 'Empty file');
    }

    console.log(`File decoded: ${fileData.length} bytes`);

    // Ensure bucket exists
    try {
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (bucketsError) {
        console.error('Error listing buckets:', bucketsError);
        return errorResponse(500, 'Error listing buckets', bucketsError);
      }

      const bucketExists = buckets?.some(b => b.name === CUSTOMIZATION_BUCKET);
      console.log(`Bucket '${CUSTOMIZATION_BUCKET}' exists: ${bucketExists}`);

      if (!bucketExists) {
        console.log(`Creating bucket: ${CUSTOMIZATION_BUCKET}`);
        const { error: createError } = await supabase.storage.createBucket(CUSTOMIZATION_BUCKET, {
          public: true,
          fileSizeLimit: 5242880, // 5MB
          allowedMimeTypes: ALLOWED_MIME_TYPES
        });
        
        if (createError) {
          console.error('Failed to create bucket:', createError);
          return errorResponse(500, 'Failed to create bucket', createError);
        }
        console.log(`Bucket created: ${CUSTOMIZATION_BUCKET}`);
      }
    } catch (bucketError) {
      console.error('Error handling bucket:', bucketError);
      // Continue anyway, the bucket might actually exist
    }

    // Generate safe filename
    const fileName = generateCustomizationFilename(originalName, orderId, productId);
    console.log(`Generated filename: ${fileName}`);

    // Upload file
    console.log(`Uploading file: ${fileName} (${fileData.length} bytes, ${contentType})`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(CUSTOMIZATION_BUCKET)
      .upload(fileName, fileData, {
        contentType,
        upsert: false,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Upload failed:', uploadError);
      return errorResponse(500, 'Upload failed', uploadError);
    }

    console.log('Upload succeeded:', uploadData);

    // Get public URL
    const { data: urlData } = await supabase.storage
      .from(CUSTOMIZATION_BUCKET)
      .getPublicUrl(fileName);

    if (!urlData || !urlData.publicUrl) {
      console.error('Failed to get public URL');
      return errorResponse(500, 'Failed to get public URL');
    }

    const publicUrl = urlData.publicUrl;
    console.log(`Public URL: ${publicUrl}`);

    return successResponse({
      imageUrl: publicUrl,
      fileName,
      fileSize: fileData.length,
      contentType
    });

  } catch (error) {
    console.error('Error in customization image upload:', error);
    
    return errorResponse(500, 'An unexpected error occurred', {
      message: error.message,
      stack: error.stack
    });
  }
}; 