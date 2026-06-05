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
    Math.min(
      kp / 9,
      1
    );

  const alpha =
    strength *
    (1 - cloudCover / 100);

  ctx.save();

  for (
    let i = 0;
    i < 5;
    i++
  ) {

    const wave =
      Math.sin(
        time * 0.0005 +
        i
      ) * 30;

    const aurora =
      ctx.createLinearGradient(
        0,
        0,
        0,
        h * 0.5
      );

    aurora.addColorStop(
      0,
      `rgba(
        0,
        255,
        180,
        ${alpha * 0.3}
      )`
    );

    aurora.addColorStop(
      1,
      "rgba(0,0,0,0)"
    );

    ctx.fillStyle =
      aurora;

    ctx.fillRect(
      i * 180 + wave,
      0,
      150,
      h * 0.6
    );
  }

  ctx.restore();
}