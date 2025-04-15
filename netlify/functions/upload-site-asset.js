import { createClient } from '@supabase/supabase-js';

// Check Supabase client version
let supabaseVersion;
try {
  supabaseVersion = require('@supabase/supabase-js/package.json').version;
  console.log('Supabase client version:', supabaseVersion);
} catch (e) {
  console.log('Could not determine Supabase client version');
}

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// DEBUG: Log environment variables availability (not values for security)
console.log('Environment variables check:', {
  supabaseUrlExists: !!supabaseUrl,
  supabaseServiceKeyExists: !!supabaseServiceKey,
  nodeEnv: process.env.NODE_ENV
});

// Constants
const SITE_ASSETS_BUCKET = 'site-assets';

// Initialize Supabase client only if we have required environment variables
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/**
 * Simplified upload function
 */
export async function handler(event, context) {
  console.log('Upload function started');
  
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method not allowed' }) 
    };
  }

  // Check auth
  const token = event.headers.authorization?.split(' ')[1];
  if (!token) {
    return { 
      statusCode: 401, 
      body: JSON.stringify({ error: 'Missing authentication token' }) 
    };
  }

  try {
    // Parse request
    const req = JSON.parse(event.body);
    const { fileBase64, fileName, contentType } = req;
    
    if (!fileBase64 || !fileName || !contentType) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Missing required fields' }) 
      };
    }
    
    console.log(`Processing upload: ${fileName} (${contentType})`);
    
    // Verify admin
    const auth = await supabase.auth.getUser(token);
    if (auth.error || !auth.data.user) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Invalid token' }) 
      };
    }
    
    const userId = auth.data.user.id;
    console.log(`User authenticated: ${userId}`);
    
    // Check admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();
      
    if (profile?.role !== 'admin') {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: 'Admin access required' }) 
      };
    }
    
    console.log('Admin verified');
    
    // Process file
    const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const fileBuffer = Buffer.from(base64Data, 'base64');
    
    if (fileBuffer.length === 0) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Empty file' }) 
      };
    }
    
    console.log(`File decoded: ${fileBuffer.length} bytes`);
    
    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === SITE_ASSETS_BUCKET);
    
    if (!bucketExists) {
      await supabase.storage.createBucket(SITE_ASSETS_BUCKET, {
        public: true
      });
      console.log(`Bucket created: ${SITE_ASSETS_BUCKET}`);
    } else {
      console.log(`Bucket exists: ${SITE_ASSETS_BUCKET}`);
    }
    
    // Try multiple upload approaches
    let uploadResult;
    let errorMessages = [];
    
    // Approach 1: Standard upload
    try {
      console.log('Trying standard upload...');
      uploadResult = await supabase.storage
        .from(SITE_ASSETS_BUCKET)
        .upload(fileName, fileBuffer, {
          contentType,
          upsert: true
        });
      
      if (uploadResult.error) {
        errorMessages.push(`Standard upload failed: ${uploadResult.error.message}`);
        console.log(errorMessages[errorMessages.length - 1]);
      } else {
        console.log('Standard upload succeeded');
      }
    } catch (err) {
      errorMessages.push(`Standard upload exception: ${err.message}`);
      console.log(errorMessages[errorMessages.length - 1]);
    }
    
    // If standard approach failed, try alternative
    if (!uploadResult || uploadResult.error) {
      try {
        console.log('Trying alternative upload...');
        // Convert to Blob for older Supabase versions
        const blob = new Blob([fileBuffer], { type: contentType });
        uploadResult = await supabase.storage
          .from(SITE_ASSETS_BUCKET)
          .upload(fileName, blob, {
            upsert: true
          });
        
        if (uploadResult.error) {
          errorMessages.push(`Alternative upload failed: ${uploadResult.error.message}`);
          console.log(errorMessages[errorMessages.length - 1]);
        } else {
          console.log('Alternative upload succeeded');
        }
      } catch (err) {
        errorMessages.push(`Alternative upload exception: ${err.message}`);
        console.log(errorMessages[errorMessages.length - 1]);
      }
    }
    
    // Check final result
    if (uploadResult && !uploadResult.error) {
      console.log('Upload successful, generating URL');
      // Generate URL - try multiple approaches
      
      // Approach 1: getPublicUrl
      try {
        const { data } = supabase.storage
          .from(SITE_ASSETS_BUCKET)
          .getPublicUrl(fileName);
          
        if (data?.publicUrl) {
          console.log('URL generated via getPublicUrl');
          return {
            statusCode: 200,
            body: JSON.stringify({
              success: true,
              url: data.publicUrl,
              path: uploadResult.data?.path || fileName
            })
          };
        }
      } catch (err) {
        console.log(`getPublicUrl failed: ${err.message}`);
      }
      
      // Approach 2: Manual URL construction
      console.log('Falling back to manual URL construction');
      const fallbackUrl = `${supabaseUrl}/storage/v1/object/public/${SITE_ASSETS_BUCKET}/${fileName}`;
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          url: fallbackUrl,
          path: fileName
        })
      };
    } else {
      // All upload attempts failed
      console.log('All upload attempts failed');
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Upload failed after multiple attempts',
          details: errorMessages
        })
      };
    }
  } catch (error) {
    console.error('Unhandled error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Unexpected error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
} 