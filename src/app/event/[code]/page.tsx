import EventRoom from "./EventRoom";

export default async function EventPage(props: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ share?: string }>;
}) {
  const { code } = await props.params;
  const { share } = await props.searchParams;
  return <EventRoom code={code.toUpperCase()} initialShareUrl={share} />;
}
