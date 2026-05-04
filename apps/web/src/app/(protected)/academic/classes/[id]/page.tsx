import ClassDetailClient from './ClassDetailClient';

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClassDetailClient id={id} />;
}
