import { Navigate } from 'react-router-dom';

/** Legacy route — Shared lives under My Lists → Shared. */
export default function SharedWithMe() {
  return <Navigate to="/app/lists?status=shared" replace />;
}
