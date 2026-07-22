import { Navigate, useSearchParams } from 'react-router-dom';

export function TrainingPage() {
  const [searchParams] = useSearchParams();
  const moduleId = searchParams.get('module');
  const gameId = searchParams.get('game');

  if (moduleId === 'cognitive-training') {
    return <Navigate to={`/cognitive-training${gameId ? `?game=${encodeURIComponent(gameId)}` : ''}`} replace />;
  }

  if (moduleId === 'lower-limb-training') {
    return <Navigate to="/lower-limb-training" replace />;
  }

  return <Navigate to={`/upper-limb-training${gameId ? `?game=${encodeURIComponent(gameId)}` : ''}`} replace />;
}
