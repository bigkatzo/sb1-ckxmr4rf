import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch'; // Ensure proper fetch is available
const https = require('https');

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

// Set up a custom agent with keepalive for all requests
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  rejectUnauthorized: false // Only use in development, not recommended for production
});

// DEBUG: Log environment variables availability (not values for security)
console.log('Environment variables check:', {
  supabaseUrlExists: !!supabaseUrl,
  supabaseServiceKeyExists: !!supabaseServiceKey,
  nodeEnv: process.env.NODE_ENV
});

// Ensure we have the required environment variables
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('CRITICAL ERROR: Missing required environment variables for Supabase');
}

// Constants
const SITE_ASSETS_BUCKET = 'site-assets';

// Initialize Supabase client only if we have required environment variables
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false
      },
      global: {
        fetch: fetch,
        headers: {} 
      }
    })
  : null;

if (!supabase) {
  console.error('CRITICAL ERROR: Failed to initialize Supabase client');
}

// Helper function to log and return errors
function errorResponse(statusCode, message, details = null) {
  console.error('ERROR:', message, details);
  return {
    statusCode,
    body: JSON.stringify({
      error: message,
      details: details || undefined
    })
  };
}

// Allowed MIME types for uploads
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml' // Explicitly allow SVG files
];

/**
 * Upload site asset function
 */
export async function handler(event, context) {
  console.log('Upload function starting with event:', {
    method: event.httpMethod,
    path: event.path,
    hasAuth: !!event.headers.authorization,
    hasBody: !!event.body,
    bodyLength: event.body ? event.body.length : 0
  });
  
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  // Check if Supabase client is available
  if (!supabase) {
    return errorResponse(500, 'Supabase client not initialized - missing environment variables');
  }

  try {
    // Check auth
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
      return errorResponse(401, 'Missing authentication token');
    }
    
    console.log('Auth token received, length:', token.length);
    
    // Parse request
    let req;
    try {
      req = JSON.parse(event.body);
      console.log('Successfully parsed request body');
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return errorResponse(400, 'Invalid JSON in request body', {
        parseError: parseError.message,
        bodyStart: event.body.substring(0, 100) + '...'
      });
    }
    
    const { fileBase64, fileName, contentType } = req;
    
    if (!fileBase64 || !fileName || !contentType) {
      return errorResponse(400, 'Missing required fields', {
        hasFileBase64: !!fileBase64,
        hasFileName: !!fileName,
        hasContentType: !!contentType
      });
    }
    
    console.log(`Processing upload: ${fileName} (${contentType}), base64 data length: ${fileBase64.length}`);
    
    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      return errorResponse(415, 'Upload failed', {
        error: 'invalid_mime_type',
        message: `mime type ${contentType} is not supported`,
        statusCode: '415'
      });
    }
    
    // Verify admin
    try {
      console.log('Verifying user authentication with token');
      const { data: userData, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        console.error('Authentication error:', authError);
        return errorResponse(401, 'Invalid authentication', authError);
      }
      
      if (!userData || !userData.user) {
        console.error('No user data returned from auth');
        return errorResponse(401, 'Invalid authentication - no user found');
      }
      
      const userId = userData.user.id;
      console.log(`User authenticated: ${userId}`);
      
      // Check admin role
      console.log(`Checking admin role for user: ${userId}`);
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        return errorResponse(500, 'Error fetching user profile', profileError);
      }
      
      if (!profile) {
        console.error('No profile found for user');
        return errorResponse(403, 'No user profile found');
      }
      
      console.log(`User role from database: ${profile.role}`);
      
      if (profile.role !== 'admin') {
        console.error('User is not an admin');
        return errorResponse(403, 'Admin access required');
      }
      
      console.log('User verified as admin');
    } catch (authCheckError) {
      console.error('Unexpected error during authentication check:', authCheckError);
      return errorResponse(500, 'Authentication check failed', {
        message: authCheckError.message,
        stack: authCheckError.stack
      });
    }
    
    // Process file
    console.log('Processing file data from base64');
    const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '');
    console.log(`Base64 data length after stripping header: ${base64Data.length}`);
    
    const fileData = Buffer.from(base64Data, 'base64');
    
    if (fileData.length === 0) {
      return errorResponse(400, 'Empty file');
    }
    
    console.log(`File decoded: ${fileData.length} bytes`);
    
    try {
      // Check if bucket exists
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (bucketsError) {
        console.error('Error listing buckets:', bucketsError);
        return errorResponse(500, 'Error listing buckets', bucketsError);
      }
      
      console.log(`Buckets data:`, buckets ? `Found ${buckets.length} buckets` : 'No buckets found');
      const bucketExists = buckets?.some(b => b.name === SITE_ASSETS_BUCKET);
      console.log(`Bucket '${SITE_ASSETS_BUCKET}' exists: ${bucketExists}`);
      
      if (!bucketExists) {
        console.log(`Creating bucket: ${SITE_ASSETS_BUCKET}`);
        try {
          const { error: createError } = await supabase.storage.createBucket(SITE_ASSETS_BUCKET, {
            public: true
          });
          if (createError) {
            console.error('Failed to create bucket:', createError);
            return errorResponse(500, 'Failed to create bucket', createError);
          }
          console.log(`Bucket created: ${SITE_ASSETS_BUCKET}`);
        } catch (bucketCreateError) {
          console.error('Error creating bucket:', bucketCreateError);
          // Continue anyway, the bucket might actually exist
        }
      } else {
        console.log(`Bucket exists: ${SITE_ASSETS_BUCKET}`);
      }
      
      // Try uploading directly without checking if the file exists first
      console.log(`Uploading file: ${fileName} (${fileData.length} bytes, ${contentType})`);
      
      // Simplify the approach to just use the Supabase SDK with explicit options
      // to avoid any schema compatibility issues
      try {
        console.log('Attempting SDK upload with explicit options');
        
        // Try to avoid schema issues by using explicit minimal options
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(SITE_ASSETS_BUCKET)
          .upload(fileName, fileData, {
            contentType,
            upsert: true,
            duplex: 'half',
            cacheControl: '3600'
          });
          
        if (uploadError) {
          console.error('Upload failed:', JSON.stringify(uploadError));
          
          // If the error is about the "owner" column, we need to try a different approach
          if (uploadError.message && uploadError.message.includes('owner')) {
            console.log('Detected schema issue with "owner" column, attempting raw upload');
            
            // Setup direct HTTP request using node-fetch
            const url = `${supabaseUrl}/storage/v1/object/${SITE_ASSETS_BUCKET}/${fileName}`;
            console.log(`Using direct URL: ${url}`);
            
            try {
              // Create manual raw HTTP request
              const rawResponse = await fetch(url, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'Content-Type': contentType,
                  'Cache-Control': 'max-age=3600',
                  'x-upsert': 'true'
                },
                body: fileData,
                agent // Use the custom agent
              });
              
              if (!rawResponse.ok) {
                const errorText = await rawResponse.text();
                console.error(`Raw upload failed (${rawResponse.status}): ${errorText}`);
                return errorResponse(500, 'Upload failed', {
                  status: rawResponse.status,
                  statusText: rawResponse.statusText,
                  error: errorText
                });
              }
              
              console.log('Raw upload succeeded');
            } catch (rawError) {
              console.error('Exception during raw upload:', rawError);
              return errorResponse(500, 'Upload failed', rawError);
            }
          } else {
            // If it's some other error, just report it
            return errorResponse(500, 'Upload failed', uploadError);
          }
        } else {
          console.log('Upload succeeded via SDK');
        }
        
        // Generate the public URL - if we get here, the upload succeeded one way or another
        console.log('Getting public URL');
        let publicUrl = null;
        
        try {
          const { data: urlData } = await supabase.storage
            .from(SITE_ASSETS_BUCKET)
            .getPublicUrl(fileName);
          
          if (urlData && urlData.publicUrl) {
            publicUrl = urlData.publicUrl;
            console.log(`Got public URL from SDK: ${publicUrl}`);
          }
        } catch (urlError) {
          console.error('Error getting public URL from SDK:', urlError);
        }
        
        // Fallback to constructing the URL manually if needed
        if (!publicUrl) {
          publicUrl = `${supabaseUrl}/storage/v1/object/public/${SITE_ASSETS_BUCKET}/${fileName}`;
          console.log(`Constructed fallback URL: ${publicUrl}`);
        }
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            url: publicUrl,
            path: fileName
          })
        };
      } catch (uploadException) {
        console.error('Unexpected exception during upload process:', uploadException);
        return errorResponse(500, 'Unexpected upload error', {
          message: uploadException.message,
          stack: uploadException.stack
        });
      }
    } catch (fileProcessError) {
      console.error('Error processing file:', fileProcessError);
      return errorResponse(500, 'File processing error', {
        message: fileProcessError.message,
        stack: fileProcessError.stack
      });
    }
  } catch (error) {
    console.error('Unexpected top-level error:', error);
    return errorResponse(500, 'Unexpected error', { 
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }
} 