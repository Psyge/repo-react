export function drawAurora(
  ctx,
  w,
  h,
  kp,
  cloudCover,
  time
) {
  if (!kp || kp < 2) return;

  const strength =
    Math.min(kp / 9, 1);

  const alpha =
    strength *
    (1 - cloudCover / 100);

  ctx.save();

  const layers =
    Math.round(3 + kp);

  for (
    let layer = 0;
    layer < layers;
    layer++
  ) {

    ctx.beginPath();

    ctx.moveTo(
      0,
      h * 0.15
    );

    for (
      let x = 0;
      x <= w;
      x += 10
    ) {

      const y =
        h * 0.15 +

        Math.sin(
          x * 0.01 +
          time * 0.0004 +
          layer
        ) * 25 +

        Math.sin(
          x * 0.003 +
          time * 0.0002
        ) * 40 +

        layer * 12;

      ctx.lineTo(
        x,
        y
      );
    }

    ctx.lineTo(
      w,
      h * 0.6
    );

    ctx.lineTo(
      0,
      h * 0.6
    );

    ctx.closePath();

    const aurora =
      ctx.createLinearGradient(
        0,
        0,
        0,
        h * 0.6
      );

    aurora.addColorStop(
      0,
      `rgba(
        120,
        255,
        180,
        ${alpha * 0.5}
      )`
    );

    aurora.addColorStop(
      0.5,
      `rgba(
        0,
        255,
        120,
        ${alpha * 0.25}
      )`
    );

    aurora.addColorStop(
      1,
      "rgba(0,0,0,0)"
    );

    ctx.fillStyle =
      aurora;

    ctx.fill();
  }

  ctx.restore();
}