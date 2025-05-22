// frontend/src/App.jsx
import { WebSocketProvider } from './contexts/websocketContext/index';
import Container from './components/layout/Container';
import UploadAnalysis from './components/analysis/uploadAnalysis';
import AnalysisList from './components/analysis/analysisList';

function App() {
  return (
    <WebSocketProvider>
      <Container>
        <h1 className="text-3xl font-bold mb-8">PWS Tago Analysis Runner</h1>
        <UploadAnalysis />
        <AnalysisList />
      </Container>
    </WebSocketProvider>
  );
}

export default App;
