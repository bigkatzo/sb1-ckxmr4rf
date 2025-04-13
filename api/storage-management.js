// Storage Management API
// This API provides endpoints for admin storage management functions

import { createClient } from '@supabase/supabase-js';
import { findOrphanedImages } from '../src/lib/storage';

// Initialize Supabase client with environment variables
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for admin operations
);

// Storage buckets
const STORAGE_BUCKETS = ['collection-images', 'product-images'];

/**
 * Get storage statistics for all buckets
 */
export default async function handler(req, res) {
  // Enforce admin-only access
  try {
    const { user } = await supabase.auth.getUser(req.headers.authorization?.split(' ')[1]);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify user is admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getStorageStats(req, res);
      case 'POST':
        return await handleAdminAction(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Storage management API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get storage statistics 
 */
async function getStorageStats(req, res) {
  try {
    const stats = {
      buckets: [],
      totalFiles: 0,
      totalSize: 0
    };

    // Get stats for each bucket
    for (const bucket of STORAGE_BUCKETS) {
      const { data: files, error } = await supabase.storage
        .from(bucket)
        .list();

      if (error) throw error;

      const bucketSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
      
      stats.buckets.push({
        name: bucket,
        files: files.length,
        size: bucketSize
      });
      
      stats.totalFiles += files.length;
      stats.totalSize += bucketSize;
    }

    return res.status(200).json(stats);
  } catch (error) {
    console.error('Error getting storage stats:', error);
    return res.status(500).json({ error: 'Failed to get storage statistics' });
  }
}

/**
 * Handle admin actions for storage management
 */
async function handleAdminAction(req, res) {
  const { action, bucket, olderThan } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'Action is required' });
  }

  try {
    switch (action) {
      case 'findOrphaned':
        // Find potentially orphaned images
        const dateThreshold = olderThan ? new Date(olderThan) : undefined;
        const targetBucket = bucket || 'collection-images';
        
        if (!STORAGE_BUCKETS.includes(targetBucket)) {
          return res.status(400).json({ error: 'Invalid bucket specified' });
        }
        
        const orphanedImages = await findOrphanedImages(targetBucket, dateThreshold);
        return res.status(200).json({ orphanedImages });
        
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error handling admin action:', error);
    return res.status(500).json({ error: 'Failed to perform action' });
  }
} 