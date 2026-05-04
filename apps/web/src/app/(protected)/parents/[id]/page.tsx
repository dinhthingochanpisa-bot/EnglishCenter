import ParentProfileClient from './ParentProfileClient';

export const metadata = {
  title: 'Parent Profile | English Center CRM',
};

export default async function ParentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ParentProfileClient id={id} />;
}
