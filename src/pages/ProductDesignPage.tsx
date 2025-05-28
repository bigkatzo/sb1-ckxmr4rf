import { useParams, Navigate, Link } from 'react-router-dom';
import { useProduct } from '../hooks/useProduct';
import { useState, useEffect } from 'react';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export function ProductDesignPage() {
  const { productSlug, collectionSlug } = useParams();
  const { product, loading, error } = useProduct(collectionSlug, productSlug);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    // Set page title
    if (product) {
      document.title = `Design Files: ${product.name} | ${product.collectionName || 'store.fun'}`;
    }
    return () => {
      document.title = 'store.fun';
    };
  }, [product]);

  // Handle download of all files as a zip
  const handleDownloadAll = async () => {
    if (!product) return;
    
    try {
      setDownloading(true);
      
      const zip = new JSZip();
      
      // Add product images to zip
      if (product.images && product.images.length > 0) {
        const imagesFolder = zip.folder('product-images');
        if (imagesFolder) {
          await Promise.all(product.images.map(async (imageUrl, index) => {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const filename = getFilenameFromUrl(imageUrl) || `product-image-${index + 1}.${getExtensionFromMimeType(blob.type)}`;
            imagesFolder.file(filename, blob);
          }));
        }
      }
      
      // Add design files to zip
      if (product.designFiles && product.designFiles.length > 0) {
        const designFolder = zip.folder('design-files');
        if (designFolder) {
          await Promise.all(product.designFiles.map(async (fileUrl: string, index: number) => {
            const response = await fetch(fileUrl);
            const blob = await response.blob();
            const filename = getFilenameFromUrl(fileUrl) || `design-file-${index + 1}.${getExtensionFromMimeType(blob.type)}`;
            designFolder.file(filename, blob);
          }));
        }
      }
      
      // Generate the zip file
      const content = await zip.generateAsync({ type: 'blob' });
      
      // Save the zip file
      saveAs(content, `${product.name.replace(/\s+/g, '-').toLowerCase()}-design-files.zip`);
    } catch (error) {
      console.error('Error downloading files:', error);
    } finally {
      setDownloading(false);
    }
  };

  // Helper function to extract filename from URL
  const getFilenameFromUrl = (url: string): string => {
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const segments = pathname.split('/');
      return segments[segments.length - 1];
    } catch (error) {
      return '';
    }
  };

  // Helper function to get file extension from MIME type
  const getExtensionFromMimeType = (mimeType: string): string => {
    const map: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/gif': 'gif',
      'application/pdf': 'pdf'
    };
    return map[mimeType] || 'png';
  };

  // Function to handle individual file download
  const handleDownloadFile = async (fileUrl: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const filename = getFilenameFromUrl(fileUrl) || 'design-file.png';
      saveAs(blob, filename);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  // Only redirect if we're not loading and there's an error or no product
  if (!loading && (error || !product)) {
    return <Navigate to={`/${collectionSlug}`} replace />;
  }

  const hasDesignFiles = product?.designFiles && product.designFiles.length > 0;
  const hasProductImages = product?.images && product.images.length > 0;

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Back button */}
        <div className="mb-8">
          <Link 
            to={`/${collectionSlug}/${productSlug}`}
            className="inline-flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to product
          </Link>
        </div>
        
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-2">{product?.name}</h1>
          <p className="text-gray-400">Design Files</p>
        </div>
        
        {/* Main content */}
        <div className="space-y-12">
          {/* Download all button */}
          {(hasDesignFiles || hasProductImages) && (
            <div className="flex justify-end">
              <button
                onClick={handleDownloadAll}
                disabled={downloading}
                className="bg-primary hover:bg-primary/80 px-6 py-2 rounded-lg transition-colors disabled:opacity-50 text-white flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {downloading ? 'Preparing download...' : 'Download All Files'}
              </button>
            </div>
          )}
          
          {/* Design Files Section */}
          {hasDesignFiles && product?.designFiles ? (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold border-b border-gray-800 pb-2">Design Files</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {product.designFiles.map((fileUrl: string, index: number) => (
                  <div key={index} className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900">
                    <div className="aspect-w-1 aspect-h-1 w-full">
                      <img 
                        src={fileUrl} 
                        alt={`Design file ${index + 1}`}
                        className="object-contain w-full h-full"
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Design {index + 1}</span>
                        <button
                          onClick={() => handleDownloadFile(fileUrl)}
                          className="text-primary hover:text-primary/80 transition-colors"
                          title="Download file"
                        >
                          <Download className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-lg p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-gray-500 mb-4" />
              <h3 className="text-xl font-medium mb-2">No design files available</h3>
              <p className="text-gray-400">This product doesn't have any design files.</p>
            </div>
          )}
          
          {/* Product Images Section */}
          {hasProductImages && product?.images && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold border-b border-gray-800 pb-2">Product Images</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {product.images.map((imageUrl: string, index: number) => (
                  <div key={index} className="border border-gray-800 rounded-lg overflow-hidden bg-gray-900">
                    <div className="aspect-w-1 aspect-h-1 w-full">
                      <img 
                        src={imageUrl} 
                        alt={`Product image ${index + 1}`}
                        className="object-contain w-full h-full"
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Image {index + 1}</span>
                        <button
                          onClick={() => handleDownloadFile(imageUrl)}
                          className="text-primary hover:text-primary/80 transition-colors"
                          title="Download file"
                        >
                          <Download className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 