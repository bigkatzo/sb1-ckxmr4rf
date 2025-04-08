import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteTracking } from '../../services/tracking';

interface DeleteTrackingButtonProps {
  trackingNumber: string;
  carrier?: number;
  onDeleted?: () => void;
  disabled?: boolean;
}

/**
 * Button to delete a tracking number from both database and 17TRACK
 */
const DeleteTrackingButton: React.FC<DeleteTrackingButtonProps> = ({
  trackingNumber,
  carrier,
  onDeleted,
  disabled = false
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    show: false,
    message: '',
    type: 'info'
  });

  const handleDelete = async () => {
    setLoading(true);
    try {
      const result = await deleteTracking(trackingNumber, carrier);
      
      if (result.success) {
        setAlert({
          show: true,
          message: 'Tracking number deleted successfully',
          type: 'success'
        });
        setConfirmOpen(false);
        
        // Notify parent component if needed
        if (onDeleted) {
          onDeleted();
        }
      } else {
        // Even partial success is handled
        let message = result.message || 'Failed to delete tracking';
        
        if (result.dbSuccess && !result.apiSuccess) {
          message = 'Tracking removed from database but removal from 17TRACK failed';
          // We might still want to notify parent component since the database record is gone
          if (onDeleted) {
            onDeleted();
          }
        }
        
        setAlert({
          show: true,
          message,
          type: result.dbSuccess ? 'warning' : 'error'
        });
        setConfirmOpen(false);
      }

      // Automatically hide alert after 4 seconds
      setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 4000);
    } catch (error: any) {
      setAlert({
        show: true,
        message: `Error: ${error.message}`,
        type: 'error'
      });
      // Automatically hide alert after 4 seconds
      setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
        onClick={() => setConfirmOpen(true)}
        disabled={disabled || loading}
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>

      {/* Confirmation Dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-white mb-4">Delete Tracking Number</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete tracking number <strong>{trackingNumber}</strong>? 
              This will remove it from both our database and 17TRACK. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {alert.show && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`
            px-4 py-3 rounded-lg shadow-lg
            ${alert.type === 'success' ? 'bg-green-500' : ''}
            ${alert.type === 'error' ? 'bg-red-500' : ''}
            ${alert.type === 'warning' ? 'bg-yellow-500' : ''}
            ${alert.type === 'info' ? 'bg-blue-500' : ''}
          `}>
            <p className="text-white">{alert.message}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default DeleteTrackingButton; 