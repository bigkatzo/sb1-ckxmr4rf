import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

interface StorageStats {
  buckets: {
    name: string;
    files: number;
    size: number;
  }[];
  totalFiles: number;
  totalSize: number;
}

export default function StorageManagement() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [selectedBucket, setSelectedBucket] = useState('collection-images');
  const [orphanedImages, setOrphanedImages] = useState<string[]>([]);
  const [olderThan, setOlderThan] = useState('');
  const [error, setError] = useState('');

  // Format bytes to human-readable format
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  };

  // Load storage stats
  const loadStats = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/storage-management');
      
      if (!response.ok) {
        throw new Error('Failed to load storage statistics');
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error loading storage stats:', err);
      setError('Failed to load storage statistics');
    } finally {
      setLoading(false);
    }
  };

  // Find orphaned images
  const findOrphaned = async () => {
    setLoading(true);
    setError('');
    setOrphanedImages([]);
    
    try {
      const response = await fetch('/api/storage-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'findOrphaned',
          bucket: selectedBucket,
          olderThan: olderThan ? new Date(olderThan).toISOString() : undefined
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to find orphaned images');
      }
      
      const { orphanedImages } = await response.json();
      setOrphanedImages(orphanedImages || []);
      
      toast.info(`Found ${orphanedImages.length} potentially orphaned images in ${selectedBucket}`);
    } catch (err) {
      console.error('Error finding orphaned images:', err);
      setError('Failed to find orphaned images');
    } finally {
      setLoading(false);
    }
  };

  // Load stats on initial render
  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Storage Management</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}
      
      {/* Storage Stats */}
      <div className="mb-8 p-4 border border-gray-200 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Storage Statistics</h2>
        
        {loading && !stats ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : stats ? (
          <>
            <p className="mb-2">Total Files: {stats.totalFiles}</p>
            <p className="mb-4">Total Size: {formatBytes(stats.totalSize)}</p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bucket
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Files
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.buckets.map(bucket => (
                    <tr key={bucket.name}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {bucket.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {bucket.files}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatBytes(bucket.size)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <button 
              className="mt-4 bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded text-sm"
              onClick={loadStats}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </>
        ) : (
          <p>No data available</p>
        )}
      </div>
      
      {/* Orphaned Image Finder */}
      <div className="mb-8 p-4 border border-gray-200 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Find Potentially Orphaned Images</h2>
        
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <select 
            value={selectedBucket} 
            onChange={(e) => setSelectedBucket(e.target.value)}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
          >
            <option value="collection-images">Collection Images</option>
            <option value="product-images">Product Images</option>
          </select>
          
          <input
            type="date"
            value={olderThan}
            onChange={(e) => setOlderThan(e.target.value)}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
            placeholder="Older than"
          />
          
          <button 
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
            onClick={findOrphaned}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Find Orphaned Images'}
          </button>
        </div>
        
        {orphanedImages.length > 0 ? (
          <div className="max-h-[300px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Filename
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orphanedImages.map(path => (
                  <tr key={path}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {path}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No orphaned images found</p>
        )}
      </div>
      
      <p className="text-sm text-gray-500">
        Note: This tool provides guidance for potential storage cleanup. Images referenced in order history should be preserved.
        Always verify before deleting any files.
      </p>
    </div>
  );
} 