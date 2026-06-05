export async function fetchKp() {
  const res =
    await fetch(
      "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
    );

  const data =
    await res.json();

  return parseFloat(
    data[data.length - 1][1]
  );
}