export async function fetchCloudCover(
  lat,
  lon
) {
  const res =
    await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=cloud_cover`
    );

  const data =
    await res.json();

  return (
    data.current
      ?.cloud_cover ?? 0
  );
}