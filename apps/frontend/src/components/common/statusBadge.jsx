// frontend/src/components/common/StatusBadge.jsx
import PropTypes from 'prop-types';

const statusColors = {
  running: 'bg-green-100 text-green-800',
  stopped: 'bg-gray-100 text-gray-800',
  error: 'bg-red-100 text-red-800',
};

export default function StatusBadge({ status }) {
  const colorClasses = statusColors[status] || 'bg-gray-100 text-gray-800';

  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${colorClasses}`}
    >
      {status}
    </span>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.oneOf(['running', 'stopped', 'error']).isRequired,
};
