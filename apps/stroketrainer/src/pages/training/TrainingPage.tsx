import { Navigate, useSearchParams } from 'react-router-dom';

export function TrainingPage() {
  const [searchParams] = useSearchParams();
  const moduleId = searchParams.get('module');
  const gameId = searchParams.get('game');

  if (moduleId === 'cognitive-training') {
    return <Navigate to="/cognitive-training" replace />;
  }

  if (moduleId === 'speech-training') {
    return <Navigate to="/speech-training" replace />;
  }

  return <Navigate to={`/motor-training${gameId ? `?game=${gameId}` : ''}`} replace />;
}
