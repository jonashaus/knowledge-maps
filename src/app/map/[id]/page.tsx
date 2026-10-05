import { MapEditor } from "@/components/map/map-editor";

export default async function MapPage({ params }: PageProps<"/map/[id]">) {
  const { id } = await params;
  return <MapEditor id={id} />;
}
