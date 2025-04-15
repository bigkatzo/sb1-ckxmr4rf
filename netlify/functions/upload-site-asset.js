import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Constants
const SITE_ASSETS_BUCKET = 'site-assets';

// Initialize Supabase client only if we have required environment variables
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/**
 * Netlify function to upload site assets with admin privileges
 */
export async function handler(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Check if Supabase is properly configured
  if (!supabase) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Missing Supabase environment variables',
        message: 'Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your Netlify environment variables.'
      })
    };
  }

  // Require authentication
  const token = event.headers.authorization?.split(' ')[1];
  if (!token) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  try {
    // Verify the user is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ 
          error: 'Unauthorized',
          message: 'Invalid authentication token'
        }) 
      };
    }

    // Check if user is an admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return { 
        statusCode: 403, 
        body: JSON.stringify({
          error: 'Forbidden',
          message: 'Admin access required'
        })
      };
    }

    // Parse the request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid request',
          message: 'Request body must be valid JSON'
        })
      };
    }

    // Validate the request
    const { fileBase64, fileName, contentType } = requestBody;
    if (!fileBase64 || !fileName || !contentType) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid request',
          message: 'fileBase64, fileName, and contentType are required'
        })
      };
    }

    // Decode the base64 file
    let fileData;
    try {
      // Remove data URL prefix if present (e.g., "data:image/png;base64,")
      const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '');
      fileData = Buffer.from(base64Data, 'base64');
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid file data',
          message: 'Could not decode base64 data'
        })
      };
    }

    // Ensure the site-assets bucket exists
    try {
      // Check if bucket exists
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === SITE_ASSETS_BUCKET);
      
      if (!bucketExists) {
        // Create the bucket
        const { error: createError } = await supabase.storage.createBucket(SITE_ASSETS_BUCKET, {
          public: true
        });
        
        if (createError) {
          console.error('Error creating bucket:', createError);
          return {
            statusCode: 500,
            body: JSON.stringify({
              error: 'Failed to create storage bucket',
              details: createError
            })
          };
        }
      } else {
        // Update the bucket to be public if it already exists
        const { error: updateError } = await supabase.storage.updateBucket(SITE_ASSETS_BUCKET, {
          public: true
        });
        
        if (updateError) {
          console.warn('Warning: Could not update bucket policy:', updateError);
        }
      }
    } catch (bucketError) {
      console.error('Error checking/creating bucket:', bucketError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to check/create storage bucket',
          details: bucketError.message
        })
      };
    }
    
    // Upload the file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(SITE_ASSETS_BUCKET)
      .upload(fileName, fileData, {
        contentType,
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to upload file',
          details: uploadError
        })
      };
    }

    // Get the public URL
    const { data } = supabase.storage
      .from(SITE_ASSETS_BUCKET)
      .getPublicUrl(fileName);
    
    const publicUrl = data?.publicUrl;
    
    if (!publicUrl) {
      console.error('Error getting public URL');
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to get public URL for uploaded file'
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        url: publicUrl,
        path: uploadData?.path || fileName
      })
    };
  } catch (error) {
    console.error('Error in upload-site-asset function:', error);
    // Log more detailed error info
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'An unexpected error occurred',
        details: error.message,
        errorType: error.name
      })
    };
  }
} 