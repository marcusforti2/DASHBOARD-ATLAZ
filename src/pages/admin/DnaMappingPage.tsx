import { useState } from 'react';
import DnaAdminDashboard from './DnaAdminDashboard';
import DnaSubmissionDetail from './DnaSubmissionDetail';

export default function DnaMappingPage() {
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

  if (selectedSubmissionId) {
    return <DnaSubmissionDetail submissionId={selectedSubmissionId} onBack={() => setSelectedSubmissionId(null)} />;
  }

  return <DnaAdminDashboard onViewSubmission={(id) => setSelectedSubmissionId(id)} />;
}
