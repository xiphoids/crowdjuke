import EventRoom from "./EventRoom";

export default async function EventPage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  return <EventRoom code={code.toUpperCase()} />;
}
