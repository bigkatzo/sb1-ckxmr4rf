import { createClient } from '@supabase/supabase-js';

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
 * Netlify function to upload site assets with admin privileges
 */
export async function handler(event, context) {
  console.log('Upload site asset function called');
  
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    console.log('Method not allowed:', event.httpMethod);
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Check if Supabase is properly configured
  if (!supabase) {
    console.error('Supabase client not initialized - missing environment variables');
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
    console.log('No authorization token provided');
    return { statusCode: 401, body: 'Unauthorized' };
  }

  try {
    console.log('Starting upload process with authorization');
    
    // Verify the user is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error or no user found:', authError);
      return { 
        statusCode: 401, 
        body: JSON.stringify({ 
          error: 'Unauthorized',
          message: 'Invalid authentication token'
        }) 
      };
    }

    console.log('User verified:', user.id);

    // Check if user is an admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return { 
        statusCode: 403, 
        body: JSON.stringify({
          error: 'Profile fetch failed',
          message: 'Could not verify admin status'
        })
      };
    }
    
    if (profile?.role !== 'admin') {
      console.error('User not admin:', profile);
      return { 
        statusCode: 403, 
        body: JSON.stringify({
          error: 'Forbidden',
          message: 'Admin access required'
        })
      };
    }

    console.log('Admin check passed');

    // Parse the request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
      console.log('Request body parsed successfully');
    } catch (e) {
      console.error('Error parsing request body:', e);
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
    if (!fileBase64) {
      console.error('Missing fileBase64 in request');
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid request',
          message: 'fileBase64 is required'
        })
      };
    }
    
    if (!fileName) {
      console.error('Missing fileName in request');
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid request',
          message: 'fileName is required'
        })
      };
    }
    
    if (!contentType) {
      console.error('Missing contentType in request');
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid request',
          message: 'contentType is required'
        })
      };
    }

    console.log('Request validation passed:', { fileName, contentType });

    // Decode the base64 file
    let fileData;
    try {
      // Remove data URL prefix if present (e.g., "data:image/png;base64,")
      const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '');
      fileData = Buffer.from(base64Data, 'base64');
      console.log('File decoded successfully, size:', fileData.length);
      
      // Check if file data is valid
      if (fileData.length === 0) {
        throw new Error('Decoded file has zero bytes');
      }
    } catch (e) {
      console.error('Error decoding base64 data:', e);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid file data',
          message: 'Could not decode base64 data: ' + e.message
        })
      };
    }

    // Ensure the site-assets bucket exists
    try {
      console.log('Checking if bucket exists:', SITE_ASSETS_BUCKET);
      // Check if bucket exists
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        console.error('Error listing buckets:', bucketsError);
        throw new Error('Could not list storage buckets: ' + bucketsError.message);
      }
      
      console.log('Buckets available:', buckets ? buckets.map(b => b.name).join(', ') : 'none');
      const bucketExists = buckets?.some(bucket => bucket.name === SITE_ASSETS_BUCKET);
      
      if (!bucketExists) {
        console.log('Bucket does not exist, creating:', SITE_ASSETS_BUCKET);
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
        console.log('Bucket created successfully');
      } else {
        console.log('Bucket already exists, updating policy');
        // Update the bucket to be public if it already exists
        const { error: updateError } = await supabase.storage.updateBucket(SITE_ASSETS_BUCKET, {
          public: true
        });
        
        if (updateError) {
          console.warn('Warning: Could not update bucket policy:', updateError);
        } else {
          console.log('Bucket policy updated successfully');
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
    console.log('Uploading file to Supabase storage');
    let uploadData;
    let uploadError;
    
    try {
      const result = await supabase.storage
        .from(SITE_ASSETS_BUCKET)
        .upload(fileName, fileData, {
          contentType,
          cacheControl: '3600',
          upsert: true
        });
      
      uploadData = result.data;
      uploadError = result.error;
    } catch (directError) {
      console.error('Direct exception during upload:', directError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Upload operation failed with exception',
          details: directError.message,
          stack: directError.stack
        })
      };
    }

    if (uploadError) {
      console.error('Error from Supabase uploading file:', uploadError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to upload file',
          details: uploadError
        })
      };
    }

    console.log('File uploaded successfully, getting public URL');
    
    // Get the public URL
    let publicUrl;
    try {
      const { data } = supabase.storage
        .from(SITE_ASSETS_BUCKET)
        .getPublicUrl(fileName);
      
      publicUrl = data?.publicUrl;
      
      console.log('Public URL retrieved:', publicUrl);
      
      if (!publicUrl) {
        throw new Error('No public URL returned from Supabase');
      }
    } catch (urlError) {
      console.error('Error getting public URL:', urlError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to get public URL for uploaded file',
          details: urlError.message
        })
      };
    }

    console.log('Operation successful, returning response');
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        url: publicUrl,
        path: uploadData?.path || fileName
      })
    };
  } catch (error) {
    console.error('Unhandled error in upload-site-asset function:', error);
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
        errorType: error.name,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      })
    };
  }
} 