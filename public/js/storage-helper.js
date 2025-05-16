/**
 * Storage Upload Helper
 * 
 * This utility script helps fix issues with Supabase Storage uploads,
 * particularly handling the common multipart/form-data vs binary upload issues.
 */

class StorageUploadHelper {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.activeUploads = new Map(); // Track ongoing uploads
    this.uploadListeners = new Map(); // Listeners for upload progress events
  }

  /**
   * Upload a file to a bucket with proper error handling
   * @param {File} file - The file object to upload
   * @param {string} bucketName - The bucket to upload to
   * @param {string} [customPath] - Optional custom path (if not provided, will use a unique name)
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} - Upload result with file URL
   */
  async uploadFile(file, bucketName, customPath = null, options = {}) {
    try {
      // Generate a unique upload ID
      const uploadId = Math.random().toString(36).substring(2, 12);
      
      // Initialize progress tracking
      this.initProgressTracking(uploadId, file.name, file.size);
      
      // Step 1: Convert the file to a proper binary blob/array buffer
      this.updateProgress(uploadId, 0.1, 'Preparing file');
      const arrayBuffer = await this.fileToArrayBuffer(file);
      const fileBlob = new Blob([arrayBuffer], { type: file.type });
      
      // Step 2: Generate a safe unique filename if no custom path provided
      this.updateProgress(uploadId, 0.2, 'Generating filename');
      let filePath = customPath;
      if (!filePath) {
        filePath = await this.generateUniqueFilename(file.name, options.collection || 'default');
      }
      
      // Step 3: Properly set the content type from the actual file
      this.updateProgress(uploadId, 0.3, 'Preparing upload');
      const contentType = file.type || this.getMimeTypeFromExtension(file.name);
      
      // Step 4: Use binary upload method directly rather than SDK
      this.updateProgress(uploadId, 0.4, 'Starting upload');
      
      // Track upload via XHR to monitor progress
      if (options.trackProgress !== false) {
        const result = await this.uploadWithProgress(fileBlob, bucketName, filePath, contentType, uploadId);
        
        // Step 5: Return a nice result with URLs
        this.updateProgress(uploadId, 1, 'Upload complete');
        this.completeProgress(uploadId, 'success');
        
        return {
          success: true,
          path: filePath,
          url: this.getPublicUrl(bucketName, filePath),
          renderUrl: this.getRenderUrl(bucketName, filePath),
          uploadId,
          ...result
        };
      } else {
        // Use regular fetch without progress tracking
        const result = await this.directBinaryUpload(fileBlob, bucketName, filePath, contentType);
        
        // Step 5: Return a nice result with URLs
        this.updateProgress(uploadId, 1, 'Upload complete');
        this.completeProgress(uploadId, 'success');
        
        return {
          success: true,
          path: filePath,
          url: this.getPublicUrl(bucketName, filePath),
          renderUrl: this.getRenderUrl(bucketName, filePath),
          uploadId,
          ...result
        };
      }
    } catch (error) {
      console.error('Storage upload error:', error);
      
      // Try fallback method if first attempt failed
      if (!options.isRetry) {
        console.log('Trying fallback upload method...');
        return this.fallbackUpload(file, bucketName, customPath, { ...options, isRetry: true });
      }
      
      // Mark any active upload as failed
      if (options.uploadId) {
        this.completeProgress(options.uploadId, 'error', error.message);
      }
      
      throw new Error(`Failed to upload file: ${error.message || 'Unknown error'}`);
    }
  }
  
  /**
   * Initialize progress tracking for an upload
   * @param {string} uploadId - Unique ID for this upload
   * @param {string} fileName - File name
   * @param {number} fileSize - File size in bytes
   */
  initProgressTracking(uploadId, fileName, fileSize) {
    this.activeUploads.set(uploadId, {
      fileName,
      fileSize,
      progress: 0,
      status: 'preparing',
      startTime: Date.now(),
      message: 'Initializing upload'
    });
    
    // Dispatch initial progress event
    this.dispatchProgressEvent(uploadId);
  }
  
  /**
   * Update progress for an upload
   * @param {string} uploadId - Unique ID for this upload
   * @param {number} progress - Progress value from 0 to 1
   * @param {string} message - Status message
   */
  updateProgress(uploadId, progress, message) {
    if (this.activeUploads.has(uploadId)) {
      const upload = this.activeUploads.get(uploadId);
      upload.progress = progress;
      upload.message = message;
      upload.status = progress < 1 ? 'uploading' : 'processing';
      
      // Dispatch progress event
      this.dispatchProgressEvent(uploadId);
    }
  }
  
  /**
   * Mark an upload as complete
   * @param {string} uploadId - Unique ID for this upload
   * @param {string} status - Final status (success, error, cancelled)
   * @param {string} [message] - Optional status message
   */
  completeProgress(uploadId, status, message) {
    if (this.activeUploads.has(uploadId)) {
      const upload = this.activeUploads.get(uploadId);
      upload.status = status;
      upload.endTime = Date.now();
      upload.duration = upload.endTime - upload.startTime;
      
      if (message) {
        upload.message = message;
      } else if (status === 'success') {
        upload.message = 'Upload complete';
      } else if (status === 'error') {
        upload.message = 'Upload failed';
      } else if (status === 'cancelled') {
        upload.message = 'Upload cancelled';
      }
      
      // Dispatch final progress event
      this.dispatchProgressEvent(uploadId);
      
      // Remove upload from active tracking after a delay
      setTimeout(() => {
        this.activeUploads.delete(uploadId);
      }, 5000);
    }
  }
  
  /**
   * Dispatch a progress event for listeners
   * @param {string} uploadId - Unique ID for the upload
   */
  dispatchProgressEvent(uploadId) {
    if (this.activeUploads.has(uploadId)) {
      const upload = this.activeUploads.get(uploadId);
      const event = {
        ...upload,
        id: uploadId,
        progressPercent: Math.round(upload.progress * 100)
      };
      
      // Call listeners for this specific upload
      if (this.uploadListeners.has(uploadId)) {
        this.uploadListeners.get(uploadId).forEach(listener => {
          try {
            listener(event);
          } catch (e) {
            console.error('Error in upload listener:', e);
          }
        });
      }
      
      // Call global listeners
      if (this.uploadListeners.has('all')) {
        this.uploadListeners.get('all').forEach(listener => {
          try {
            listener(event);
          } catch (e) {
            console.error('Error in global upload listener:', e);
          }
        });
      }
      
      // Also dispatch a DOM event for components to listen to
      const progressEvent = new CustomEvent('storage-upload-progress', { 
        detail: event,
        bubbles: true 
      });
      document.dispatchEvent(progressEvent);
    }
  }
  
  /**
   * Add a listener for upload progress events
   * @param {Function} listener - Callback function
   * @param {string} [uploadId='all'] - Specific upload ID or 'all'
   * @returns {Function} - Function to remove the listener
   */
  addProgressListener(listener, uploadId = 'all') {
    if (!this.uploadListeners.has(uploadId)) {
      this.uploadListeners.set(uploadId, new Set());
    }
    
    this.uploadListeners.get(uploadId).add(listener);
    
    // Return a function to remove this listener
    return () => {
      if (this.uploadListeners.has(uploadId)) {
        this.uploadListeners.get(uploadId).delete(listener);
      }
    };
  }
  
  /**
   * Cancel an active upload by ID
   * @param {string} uploadId - The ID of the upload to cancel
   * @returns {boolean} - Whether the cancellation was successful
   */
  cancelUpload(uploadId) {
    // Not fully implemented yet as we're using fetch API which doesn't support
    // cancellation directly. Will require using XMLHttpRequest.
    if (this.activeUploads.has(uploadId)) {
      this.completeProgress(uploadId, 'cancelled', 'Upload cancelled by user');
      return true;
    }
    return false;
  }
  
  /**
   * Upload a file with progress tracking via XMLHttpRequest
   * @param {Blob} fileBlob - The file data as blob
   * @param {string} bucket - The bucket name
   * @param {string} path - The file path
   * @param {string} contentType - The content type
   * @param {string} uploadId - The unique upload ID for tracking
   * @returns {Promise<Object>} - Upload result
   */
  uploadWithProgress(fileBlob, bucket, path, contentType, uploadId) {
    return new Promise((resolve, reject) => {
      const baseUrl = this.supabase.storageUrl || this.supabase.supabaseUrl;
      const apiKey = this.supabase.supabaseKey || this.supabase.apiKey || this.supabase._options?.global?.headers?.apikey;
      
      if (!apiKey) {
        reject(new Error('Missing API key for storage upload'));
        return;
      }
      
      const url = `${baseUrl}/storage/v1/object/${bucket}/${path}`;
      
      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          // Calculate progress percentage (0.4-0.9 range to account for prepare and finalize steps)
          const uploadProgress = 0.4 + (event.loaded / event.total) * 0.5;
          this.updateProgress(uploadId, uploadProgress, 'Uploading file');
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          this.updateProgress(uploadId, 0.95, 'Processing upload');
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            resolve({ path }); // Fallback if response isn't JSON
          }
        } else {
          let errorData;
          try {
            errorData = JSON.parse(xhr.responseText);
          } catch (e) {
            errorData = { status: xhr.status, statusText: xhr.statusText };
          }
          console.error('Storage upload error:', errorData);
          reject(new Error(errorData.error || errorData.message || `HTTP Error: ${xhr.status}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });
      
      xhr.addEventListener('abort', () => {
        reject(new Error('Upload aborted'));
      });
      
      // Set up and send the request
      xhr.open('POST', url);
      xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
      xhr.setRequestHeader('apikey', apiKey);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.send(fileBlob);
    });
  }
  
  /**
   * Convert a file to array buffer
   * @param {File} file - The file to convert
   * @returns {Promise<ArrayBuffer>}
   */
  fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }
  
  /**
   * Directly upload binary data using fetch API
   * @param {Blob} fileBlob - The file data as blob
   * @param {string} bucket - The bucket name
   * @param {string} path - The file path
   * @param {string} contentType - The content type
   * @returns {Promise<Object>}
   */
  async directBinaryUpload(fileBlob, bucket, path, contentType) {
    const baseUrl = this.supabase.storageUrl || this.supabase.supabaseUrl;
    const apiKey = this.supabase.supabaseKey || this.supabase.apiKey || this.supabase._options?.global?.headers?.apikey;
    
    if (!apiKey) {
      throw new Error('Missing API key for storage upload. Please check your Supabase client initialization.');
    }
    
    const url = `${baseUrl}/storage/v1/object/${bucket}/${path}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'apikey': apiKey,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      body: fileBlob
    });
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { status: response.status, statusText: response.statusText };
      }
      console.error('Storage upload error:', errorData);
      throw new Error(errorData.error || errorData.message || `HTTP Error: ${response.status}`);
    }
    
    return await response.json();
  }
  
  /**
   * Generate a unique filename based on the format {collection}{random}{date}.{type}
   * @param {string} originalFilename - The original filename (only used for extension)
   * @param {string} collection - The collection prefix for the filename
   * @returns {Promise<string>}
   */
  async generateUniqueFilename(originalFilename, collection = 'default') {
    // Try to use our server function if available
    try {
      const { data, error } = await this.supabase.rpc('get_unique_filename', {
        original_name: originalFilename
      });
      
      if (!error && data) {
        return data;
      }
    } catch (e) {
      console.warn('Could not use server-side filename generation, using client-side', e);
    }
    
    // Client-side implementation with new format: {collection}{random}{date}.{type}
    const date = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const random = Math.random().toString(36).substring(2, 10);
    const extension = this.getExtension(originalFilename);
    
    // Format: collectionrandomdate.extension (without underscores)
    return `${collection}${random}${date}.${extension}`;
  }
  
  /**
   * Get the extension from a filename
   * @param {string} filename
   * @returns {string}
   */
  getExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : 'jpg';
  }
  
  /**
   * Get the MIME type based on file extension
   * @param {string} filename
   * @returns {string}
   */
  getMimeTypeFromExtension(filename) {
    const ext = this.getExtension(filename);
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'json': 'application/json'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
  
  /**
   * Get the public URL for a file
   * @param {string} bucket
   * @param {string} path
   * @returns {string}
   */
  getPublicUrl(bucket, path) {
    // Include the API key as a query parameter for authentication
    const apiKey = this.supabase.supabaseKey || this.supabase.apiKey || this.supabase._options?.global?.headers?.apikey;
    return `${this.supabase.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
  }
  
  /**
   * Get the render URL for an image (with transformations API)
   * @param {string} bucket
   * @param {string} path
   * @returns {string}
   */
  getRenderUrl(bucket, path) {
    return `${this.supabase.supabaseUrl}/storage/v1/render/image/public/${bucket}/${path}`;
  }
  
  /**
   * Fallback upload method using the Supabase JS SDK
   * @param {File} file - The file to upload
   * @param {string} bucket - The bucket name 
   * @param {string} customPath - Optional custom path
   * @param {Object} options - Additional options
   * @returns {Promise<Object>}
   */
  async fallbackUpload(file, bucket, customPath = null, options = {}) {
    // Generate a unique filename
    const path = customPath || await this.generateUniqueFilename(file.name, options.collection || 'default');
    
    console.log(`Fallback upload to ${bucket}: ${path} (type: ${file.type})`);
    
    // Upload using the SDK with upsert option
    const { data, error } = await this.supabase
      .storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || this.getMimeTypeFromExtension(file.name)
      });
    
    if (error) {
      console.error('Fallback upload error:', error);
      throw error;
    }
    
    return {
      success: true,
      path: path,
      url: this.getPublicUrl(bucket, path),
      renderUrl: this.getRenderUrl(bucket, path),
      ...data
    };
  }
}

// Use as a global helper
window.StorageUploadHelper = StorageUploadHelper;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageUploadHelper;
}

/**
 * Simple demo function to show file upload with progress tracking
 * @param {File} file - The file to upload 
 * @param {string} bucket - Bucket name
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<Object>} Upload result
 */
async function demoUploadWithProgress(file, bucket, onProgress) {
  // Create instance of helper
  const helper = new StorageUploadHelper(supabase);
  
  // Register progress listener
  const removeListener = helper.addProgressListener((progress) => {
    console.log(`Upload progress: ${progress.progressPercent}% - ${progress.message}`);
    
    // Call user's progress callback
    if (typeof onProgress === 'function') {
      onProgress(progress);
    }
    
    // Clean up listener when complete
    if (progress.status === 'success' || progress.status === 'error' || progress.status === 'cancelled') {
      removeListener();
    }
  });
  
  // Start upload
  try {
    // Generate collection from file type
    let collection = file.type.startsWith('image/') ? 'image' : 'document';
    
    // Start upload with progress tracking enabled
    const result = await helper.uploadFile(file, bucket, null, {
      collection,
      trackProgress: true
    });
    
    return result;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

// Set as global for easy access
window.demoUploadWithProgress = demoUploadWithProgress;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageUploadHelper;
} 