// frontend/src/components/analysis/statusBadge.jsx
import PropTypes from 'prop-types';
import { Badge } from '@mantine/core';

const statusConfig = {
  running: {
    color: 'green',
    variant: 'light',
  },
  stopped: {
    color: 'brand',
    variant: 'light',
  },
  error: {
    color: 'red',
    variant: 'filled',
  },
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || {
    color: 'gray',
    variant: 'light',
  };

  return (
    <Badge
      variant={config.variant}
      size="sm"
      radius="xl"
      className={`status-badge ${status}`}
      color={config.color}
      style={{
        fontWeight: 500,
      }}
    >
      {status}
    </Badge>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.oneOf(['running', 'stopped', 'error']).isRequired,
};
