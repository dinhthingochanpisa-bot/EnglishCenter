import StudentDetailClient from './StudentDetailClient';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ModuleBoundary moduleCode="STUDENT">
      <div className="p-8 max-w-7xl mx-auto">
        <StudentDetailClient id={id} />
      </div>
    </ModuleBoundary>
  );
}
