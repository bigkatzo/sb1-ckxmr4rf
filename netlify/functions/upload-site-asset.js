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

// Helper function to log and return errors
function errorResponse(statusCode, message, details = null) {
  console.error(message, details);
  return {
    statusCode,
    body: JSON.stringify({
      error: message,
      details: details || undefined
    })
  };
}

/**
 * Upload site asset function
 */
export async function handler(event, context) {
  console.log('Upload function starting');
  
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    // Check auth
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
      return errorResponse(401, 'Missing authentication token');
    }
    
    // Parse request
    const req = JSON.parse(event.body);
    const { fileBase64, fileName, contentType } = req;
    
    if (!fileBase64 || !fileName || !contentType) {
      return errorResponse(400, 'Missing required fields');
    }
    
    console.log(`Processing upload: ${fileName} (${contentType})`);
    
    // Verify admin
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return errorResponse(401, 'Invalid authentication', authError);
    }
    
    const userId = userData.user.id;
    console.log(`User authenticated: ${userId}`);
    
    // Check admin role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();
      
    if (profileError) {
      return errorResponse(500, 'Error fetching user profile', profileError);
    }  
    
    if (profile?.role !== 'admin') {
      return errorResponse(403, 'Admin access required');
    }
    
    console.log('Admin verified');
    
    // Process file
    const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const fileData = Buffer.from(base64Data, 'base64');
    
    if (fileData.length === 0) {
      return errorResponse(400, 'Empty file');
    }
    
    console.log(`File decoded: ${fileData.length} bytes`);
    
    // Check if bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      return errorResponse(500, 'Error listing buckets', bucketsError);
    }
    
    const bucketExists = buckets?.some(b => b.name === SITE_ASSETS_BUCKET);
    
    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(SITE_ASSETS_BUCKET, {
        public: true
      });
      if (createError) {
        return errorResponse(500, 'Failed to create bucket', createError);
      }
      console.log(`Bucket created: ${SITE_ASSETS_BUCKET}`);
    } else {
      console.log(`Bucket exists: ${SITE_ASSETS_BUCKET}`);
    }
    
    // Check if file exists first (for update case)
    console.log(`Checking if file exists: ${fileName}`);
    const { data: existingFiles, error: listError } = await supabase.storage
      .from(SITE_ASSETS_BUCKET)
      .list('', { 
        search: fileName 
      });
      
    const fileExists = existingFiles?.some(file => file.name === fileName);
    console.log(`File exists check: ${fileExists}`);
    
    // If file exists, try removing it first (better update handling)
    if (fileExists) {
      console.log(`File exists, removing first: ${fileName}`);
      const { error: removeError } = await supabase.storage
        .from(SITE_ASSETS_BUCKET)
        .remove([fileName]);
        
      if (removeError) {
        console.log(`Warning: Could not remove existing file: ${removeError.message}`);
        // Continue anyway, as upsert might still work
      } else {
        console.log('Existing file removed successfully');
      }
    }
    
    // Upload the file
    console.log(`Uploading file: ${fileName}`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(SITE_ASSETS_BUCKET)
      .upload(fileName, fileData, {
        contentType,
        upsert: true, // Always use upsert
        cacheControl: '3600'
      });
      
    if (uploadError) {
      return errorResponse(500, 'Upload failed', uploadError);
    }
    
    console.log('Upload successful, getting public URL');
    const { data: urlData } = await supabase.storage
      .from(SITE_ASSETS_BUCKET)
      .getPublicUrl(fileName);
      
    if (!urlData?.publicUrl) {
      // Construct fallback URL manually
      console.log('No public URL returned, constructing manually');
      const fallbackUrl = `${supabaseUrl}/storage/v1/object/public/${SITE_ASSETS_BUCKET}/${fileName}`;
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          url: fallbackUrl,
          path: uploadData?.path || fileName
        })
      };
    }
    
    console.log(`Public URL: ${urlData.publicUrl}`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        url: urlData.publicUrl,
        path: uploadData?.path || fileName
      })
    };
    
  } catch (error) {
    return errorResponse(500, 'Unexpected error', { message: error.message, stack: error.stack });
  }
} 