/**
 * Storage Upload Helper
 * 
 * This utility script helps fix issues with Supabase Storage uploads,
 * particularly handling the common multipart/form-data vs binary upload issues.
 */

class StorageUploadHelper {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
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
      // Step 1: Convert the file to a proper binary blob/array buffer
      const arrayBuffer = await this.fileToArrayBuffer(file);
      const fileBlob = new Blob([arrayBuffer], { type: file.type });
      
      // Step 2: Generate a safe unique filename if no custom path provided
      let filePath = customPath;
      if (!filePath) {
        filePath = await this.generateUniqueFilename(file.name, options.collection || 'default');
      }
      
      // Step 3: Properly set the content type from the actual file
      const contentType = file.type || this.getMimeTypeFromExtension(file.name);
      
      // Step 4: Use binary upload method directly rather than SDK
      const result = await this.directBinaryUpload(fileBlob, bucketName, filePath, contentType);
      
      // Step 5: Return a nice result with URLs
      return {
        success: true,
        path: filePath,
        url: this.getPublicUrl(bucketName, filePath),
        renderUrl: this.getRenderUrl(bucketName, filePath),
        ...result
      };
    } catch (error) {
      console.error('Storage upload error:', error);
      
      // Try fallback method if first attempt failed
      if (!options.isRetry) {
        console.log('Trying fallback upload method...');
        return this.fallbackUpload(file, bucketName, customPath, { ...options, isRetry: true });
      }
      
      throw new Error(`Failed to upload file: ${error.message || 'Unknown error'}`);
    }
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
    const apiKey = this.supabase.supabaseKey;
    
    const url = `${baseUrl}/storage/v1/object/${bucket}/${path}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      body: fileBlob
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP Error: ${response.status}`);
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
    
    // Upload using the SDK with upsert option
    const { data, error } = await this.supabase
      .storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || this.getMimeTypeFromExtension(file.name)
      });
    
    if (error) throw error;
    
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