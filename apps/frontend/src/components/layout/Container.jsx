// frontend/src/components/layout/Container.jsx
import PropTypes from 'prop-types';
import ConnectionStatus from '../connectionStatus';
export default function Container({ children }) {
  return (
    <div className="container mx-auto px-4 py-8">
      <ConnectionStatus />
      {children}
    </div>
  );
}

Container.propTypes = {
  children: PropTypes.node.isRequired,
};
