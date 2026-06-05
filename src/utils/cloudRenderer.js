export function drawClouds(
  ctx,
  w,
  h,
  cloudCover,
  time
) {
  if (!cloudCover) return;

  ctx.save();

  const alpha =
    cloudCover / 250;

  ctx.fillStyle =
    `rgba(
      230,
      230,
      230,
      ${alpha}
    )`;

  for (
    let i = 0;
    i < 15;
    i++
  ) {

    const x =
      (
        time * 0.005 +
        i * 140
      ) %
      (w + 300);

    const y =
      80 +
      Math.sin(i) * 20;

    ctx.beginPath();

    ctx.ellipse(
      x,
      y,
      120,
      35,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }

  ctx.restore();
}