import FamilyDetailClient from './FamilyDetailClient';

export const metadata = {
  title: 'Family Detail | English Center CRM',
};

export default async function FamilyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FamilyDetailClient id={id} />;
}
