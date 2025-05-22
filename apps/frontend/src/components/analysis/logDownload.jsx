import { useState } from 'react';
import PropTypes from 'prop-types';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, Download, X } from 'lucide-react';

const LogDownloadDialog = ({ isOpen, onClose, onDownload }) => {
  const [timeRange, setTimeRange] = useState('1h');
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      await onDownload(timeRange);
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-[425px] max-w-[90vw]">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-lg font-semibold">
              Download Analysis Logs
            </Dialog.Title>

            <Dialog.Close className="rounded-full p-1 hover:bg-gray-100">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>
          <div>
            <Dialog.Description className="text-sm text-gray-500">
              Download the logs for this analysis in a .log file.
            </Dialog.Description>
          </div>
          <div className="py-4">
            <label className="text-sm font-medium block mb-2">
              Select Time Range
            </label>
            <Select.Root value={timeRange} onValueChange={setTimeRange}>
              <Select.Trigger className="inline-flex items-center justify-between w-full px-3 py-2 border rounded-md bg-white text-sm">
                <Select.Value placeholder="Select time range" />
                <Select.Icon>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </Select.Icon>
              </Select.Trigger>

              <Select.Portal>
                <Select.Content className="bg-white rounded-md shadow-lg border">
                  <Select.Viewport className="p-1">
                    <Select.Group>
                      {[
                        { value: '1h', label: 'Last Hour' },
                        { value: '24h', label: 'Last 24 Hours' },
                        { value: '7d', label: 'Last 7 Days' },
                        { value: '30d', label: 'Last 30 Days' },
                        { value: 'all', label: 'All Logs' },
                      ].map(({ value, label }) => (
                        <Select.Item
                          key={value}
                          value={value}
                          className="relative flex items-center px-6 py-2 text-sm rounded hover:bg-gray-100 cursor-pointer outline-none"
                        >
                          <Select.ItemText>{label}</Select.ItemText>
                          <Select.ItemIndicator className="absolute left-1">
                            <Check className="w-4 h-4" />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300"
            >
              <Download className="w-4 h-4" />
              {isLoading ? 'Downloading...' : 'Download'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

LogDownloadDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
};

export default LogDownloadDialog;
