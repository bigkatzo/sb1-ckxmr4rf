const { createClient } = require('@supabase/supabase-js');
const busboy = require('busboy');
const { randomBytes } = require('crypto');
const { Readable } = require('stream');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Helper to generate a unique filename
 */
function generateUniqueFilename(originalName, collection = 'default') {
  // Get file extension
  const extension = originalName.split('.').pop().toLowerCase();
  
  // Generate timestamp
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/[T.]/g, '')
    .slice(0, 14);
  
  // Generate random string
  const randomString = randomBytes(6).toString('hex');
  
  // Create filename
  return `${collection}${randomString}${timestamp}.${extension}`;
}

/**
 * Convert buffer to readable stream
 */
function bufferToStream(buffer) {
  const readable = new Readable();
  readable._read = () => {}; // _read is required but we don't need to implement it
  readable.push(buffer);
  readable.push(null);
  return readable;
}

/**
 * Parse multipart/form-data
 */
async function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    let fileBuffer = null;
    let fileName = '';
    let fileContentType = '';
    
    const bb = busboy({ headers: req.headers });
    
    bb.on('field', (name, val) => {
      fields[name] = val;
    });
    
    bb.on('file', (name, file, info) => {
      const { filename, mimeType } = info;
      fileName = filename;
      fileContentType = mimeType;
      
      const chunks = [];
      file.on('data', (data) => {
        chunks.push(data);
      });
      
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });
    
    bb.on('close', () => {
      resolve({
        fields,
        file: {
          buffer: fileBuffer,
          name: fileName,
          contentType: fileContentType
        }
      });
    });
    
    bb.on('error', (err) => {
      reject(err);
    });
    
    // Pass the request body to busboy
    req.pipe(bb);
  });
}

exports.handler = async function(event, context) {
  // Only handle POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    // Parse the multipart form data
    const formData = await parseMultipartForm(event);
    
    const { fields, file } = formData;
    const bucket = fields.bucket || 'collection-images';
    
    // Generate a path or use provided path
    let path = fields.path;
    if (!path) {
      // Extract collection from bucket
      const collection = bucket.replace(/-images$/, '')
                              .replace(/-assets$/, '')
                              .replace(/-/g, '');
      
      path = generateUniqueFilename(file.name, collection);
    }
    
    // Use content type from form or file
    const contentType = fields.contentType || file.contentType;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file.buffer, {
        contentType,
        cacheControl: '604800',
        upsert: true
      });
    
    if (error) {
      console.error('Server upload error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    
    // Return success response with URL
    return {
      statusCode: 200,
      body: JSON.stringify({
        url: publicUrl,
        path: path,
        bucket: bucket
      })
    };
    
  } catch (error) {
    console.error('Server error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}; 