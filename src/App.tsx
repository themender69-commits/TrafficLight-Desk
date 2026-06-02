import { TrafficLight } from './components/TrafficLight';
import { useTrafficLightStatus } from './hooks/useTrafficLightStatus';

export default function App() {
  const { status, tool = 'cursor', connected = false, refresh } =
    useTrafficLightStatus();

  return (
    <main className="app">
      <TrafficLight
        status={status}
        tool={tool}
        connected={connected}
        onRefresh={refresh}
      />
    </main>
  );
}
